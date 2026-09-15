import { execFileSync } from 'node:child_process'
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

// Examples run from a copy outside the repo on the unpacked tarball: a workspace link hides packaging defects.

const PKG = '@boxlab/yandex-metrica-next'
const root = process.cwd()

// Safe only because every Metrica host is blocked: the collector accepts any id, real or invented.
const COUNTER_ID = '99999999'
const DEV_COUNTER_ID = '99999998'

const TYPES = {
    '19.3.0': { '@types/react': '19.3.0', '@types/react-dom': '19.3.0' },
    '19.2.8': { '@types/react': '19.2.18', '@types/react-dom': '19.2.7' },
    '18.3.1': { '@types/react': '18.3.31', '@types/react-dom': '18.3.7' },
}

export const CELLS = {
    'next16-turbopack-client': {
        app: 'app-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'turbopack',
        variant: 'client',
        envs: ['prod', 'dev'],
    },
    'next16-webpack-component': {
        app: 'app-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'webpack',
        variant: 'component',
        envs: ['prod', 'dev'],
    },
    'next16-turbopack-sentry': {
        app: 'app-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'turbopack',
        variant: 'sentry',
        envs: ['prod', 'dev'],
    },
    'next16-turbopack-cjs-config': {
        app: 'app-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'turbopack',
        variant: 'cjs-config',
        envs: ['prod'],
    },
    'next16-turbopack-client-basepath': {
        app: 'app-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'turbopack',
        variant: 'client',
        basePath: '/shop',
        envs: ['prod'],
    },
    'next16-turbopack-pages': {
        app: 'pages-router',
        next: '16.3.5',
        react: '19.3.0',
        bundler: 'turbopack',
        variant: 'default',
        envs: ['prod', 'dev'],
    },
    'next15-webpack-component': {
        app: 'app-router',
        next: '15.5.25',
        react: '19.2.8',
        bundler: 'webpack',
        variant: 'component',
        envs: ['prod', 'dev'],
    },
    'next15-webpack-component-react18': {
        app: 'app-router',
        next: '15.5.25',
        react: '18.3.1',
        bundler: 'webpack',
        variant: 'component',
        envs: ['prod'],
    },
    'next15-webpack-pages-react18': {
        app: 'pages-router',
        next: '15.5.25',
        react: '18.3.1',
        bundler: 'webpack',
        variant: 'default',
        envs: ['prod'],
    },
}

const VARIANTS = {
    default: {},
    client: {},
    component: { remove: ['instrumentation-client.ts'] },
    sentry: { dependencies: { '@sentry/nextjs': '10.74.0' } },
    'cjs-config': { remove: ['next.config.ts'] },
}

const fail = message => {
    console.error(message)
    process.exit(1)
}

const nextMajor = cell => Number(cell.next.split('.')[0])

const bundlerFlags = cell => {
    if (cell.bundler === 'webpack' && nextMajor(cell) >= 16)
        return ['--webpack']
    if (cell.bundler === 'turbopack' && nextMajor(cell) < 16)
        return ['--turbopack']
    return []
}

const appEnv = (cell, env) => ({
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_YANDEX_METRICA_ID: COUNTER_ID,
    ...(env === 'dev'
        ? { NEXT_PUBLIC_YANDEX_METRICA_DEV_ID: DEV_COUNTER_ID }
        : {}),
    ...(cell.basePath ? { E2E_BASE_PATH: cell.basePath } : {}),
})

const pack = () => {
    execFileSync('bun', ['run', 'build'], { cwd: root, stdio: 'inherit' })
    execFileSync('bun', ['pm', 'pack'], { cwd: root, stdio: 'pipe' })
    const tarball = readdirSync(root).find(file => file.endsWith('.tgz'))
    if (!tarball) fail('bun pm pack produced no tarball')
    return join(root, tarball)
}

const prepare = (id, cell, tarball, { install }) => {
    const example = join(root, 'examples', cell.app)
    const dir = join(process.env.E2E_WORKDIR ?? join(tmpdir(), 'ymn-e2e'), id)
    mkdirSync(dir, { recursive: true })

    // Stale sources from an earlier run would be compiled alongside the fresh copy.
    for (const entry of readdirSync(dir)) {
        if (entry !== 'node_modules')
            rmSync(join(dir, entry), { recursive: true, force: true })
    }
    cpSync(example, dir, {
        recursive: true,
        filter: source => {
            const [top] = relative(example, source).split(sep)
            return !['node_modules', '.next', 'variants'].includes(top)
        },
    })

    const variant = VARIANTS[cell.variant]
    const overlay = join(example, 'variants', cell.variant)
    if (existsSync(overlay)) cpSync(overlay, dir, { recursive: true })
    for (const file of variant.remove ?? [])
        rmSync(join(dir, file), { force: true })

    // Next 15 knows only the pre-rename middleware convention.
    const proxy = join(dir, 'proxy.ts')
    if (nextMajor(cell) < 16 && existsSync(proxy)) {
        const source = readFileSync(proxy, 'utf8').replace(
            'export function proxy(',
            'export function middleware(',
        )
        writeFileSync(join(dir, 'middleware.ts'), source)
        rmSync(proxy)
    }

    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    delete manifest.dependencies[PKG]
    manifest.dependencies.next = cell.next
    manifest.dependencies.react = cell.react
    manifest.dependencies['react-dom'] = cell.react
    Object.assign(manifest.dependencies, variant.dependencies)
    Object.assign(manifest.devDependencies, TYPES[cell.react])
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`)

    if (install)
        execFileSync('bun', ['install'], { cwd: dir, stdio: 'inherit' })

    // After install, never before: bun prunes anything its manifest does not list.
    const target = join(dir, 'node_modules', PKG)
    rmSync(target, { recursive: true, force: true })
    mkdirSync(target, { recursive: true })
    execFileSync('tar', ['xzf', tarball, '-C', target, '--strip-components=1'])

    return dir
}

const build = (dir, cell) => {
    execFileSync(
        'node',
        ['node_modules/next/dist/bin/next', 'build', ...bundlerFlags(cell)],
        { cwd: dir, stdio: 'inherit', env: appEnv(cell, 'prod') },
    )
}

const test = (dir, cell, env, extra) => {
    execFileSync(
        join(root, 'node_modules/.bin/playwright'),
        ['test', ...(env === 'dev' ? ['--grep', '@dev'] : []), ...extra],
        {
            cwd: root,
            stdio: 'inherit',
            env: {
                ...appEnv(cell, env),
                E2E_APP: cell.app,
                E2E_APP_DIR: dir,
                E2E_ENV: env,
                E2E_VARIANT: cell.variant,
                E2E_NEXT_ARGS: bundlerFlags(cell).join(' '),
                E2E_COUNTER_ID: env === 'dev' ? DEV_COUNTER_ID : COUNTER_ID,
            },
        },
    )
}

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        env: { type: 'string' },
        tarball: { type: 'string' },
        'skip-install': { type: 'boolean', default: false },
    },
})

const [command, ...rest] = positionals

if (command === 'list') {
    for (const [id, cell] of Object.entries(CELLS)) {
        console.log(
            `${id}  next@${cell.next} react@${cell.react} ${cell.bundler} ${cell.variant} [${cell.envs.join(' ')}]`,
        )
    }
} else if (command === 'matrix') {
    console.log(JSON.stringify(Object.keys(CELLS)))
} else if (command === 'run') {
    const [id, ...extra] = rest
    const cell = CELLS[id]
    if (!cell) fail(`unknown cell "${id}"; run "node scripts/e2e.mjs list"`)
    const envs = values.env ? [values.env] : cell.envs
    const tarball = values.tarball ?? pack()
    const dir = prepare(id, cell, tarball, {
        install: !values['skip-install'],
    })
    for (const env of envs) {
        if (env === 'prod') build(dir, cell)
        test(dir, cell, env, extra)
    }
} else {
    fail(
        'usage: node scripts/e2e.mjs list | matrix | run <cell> [--env prod|dev] [--tarball <tgz>] [--skip-install] [-- <playwright args>]',
    )
}

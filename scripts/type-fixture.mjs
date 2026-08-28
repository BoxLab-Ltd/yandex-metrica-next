import { execFileSync } from 'node:child_process'
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// The fixture runs against the packed tarball, not against src: only that proves the
// published .d.ts files carry the goal registry and that augmentation reaches subpaths.
// The tarball is extracted straight into node_modules — `bun add <tgz>` caches by
// name@version and would silently reuse a stale copy, making the check unfalsifiable.
//
// It runs twice, once per supported React type branch, mapped through `paths` the way the
// ecosystem does it. Each branch also compiles a sentinel that only its own types accept
// and one that only the other branch accepts: without them a mapping that quietly resolved
// to the wrong package would look exactly like a passing two-branch run.

const PKG = '@boxlab/yandex-metrica-next'
const root = process.cwd()

const FIXTURE = ['augmentation.ts', 'component.tsx']

const BRANCHES = [
    {
        id: 'react19',
        react: '@types/react',
        reactDom: '@types/react-dom',
        accepts: 'sentinels/react19.ts',
        rejects: 'sentinels/react18.tsx',
    },
    {
        id: 'react18',
        react: '@types/react-18',
        reactDom: '@types/react-dom-18',
        accepts: 'sentinels/react18.tsx',
        rejects: 'sentinels/react19.ts',
    },
]

const compilerOptions = branch => ({
    target: 'ES2022',
    lib: ['ES2022', 'DOM'],
    module: 'preserve',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    strict: true,
    // Our own declarations are what this fixture exists to check, so lib checking stays on.
    skipLibCheck: false,
    noEmit: true,
    paths: {
        react: [join(root, 'node_modules', branch.react)],
        'react/*': [join(root, 'node_modules', branch.react, '*')],
        'react-dom': [join(root, 'node_modules', branch.reactDom)],
        'react-dom/*': [join(root, 'node_modules', branch.reactDom, '*')],
    },
})

const work = mkdtempSync(join(tmpdir(), 'ymn-types-'))
const failures = []

const compile = (branch, name, include) => {
    const config = join(work, `tsconfig.${name}.json`)
    writeFileSync(
        config,
        JSON.stringify({ compilerOptions: compilerOptions(branch), include }),
    )
    try {
        execFileSync(
            join(root, 'node_modules/typescript/bin/tsc'),
            ['-p', config],
            {
                cwd: work,
                stdio: 'pipe',
                encoding: 'utf8',
            },
        )
        return { ok: true, output: '' }
    } catch (error) {
        return { ok: false, output: String(error.stdout ?? '') }
    }
}

const expect = (condition, label, detail) => {
    if (condition) {
        console.log(`  ok   ${label}`)
        return
    }
    console.error(`  FAIL ${label}`)
    if (detail) console.error(detail.trimEnd())
    failures.push(label)
}

try {
    execFileSync('bun', ['pm', 'pack'], { cwd: root, stdio: 'pipe' })
    const tarball = readdirSync(root).find(f => f.endsWith('.tgz'))
    if (!tarball) throw new Error('bun pm pack produced no tarball')

    cpSync(join(root, 'test/types'), work, { recursive: true })
    writeFileSync(
        join(work, 'package.json'),
        JSON.stringify(
            { name: 'ymn-type-fixture', private: true, type: 'module' },
            null,
            2,
        ),
    )

    const target = join(work, 'node_modules', PKG)
    mkdirSync(target, { recursive: true })
    execFileSync(
        'tar',
        ['xzf', join(root, tarball), '-C', target, '--strip-components=1'],
        {
            stdio: 'pipe',
        },
    )

    for (const branch of BRANCHES) {
        console.log(`${branch.id} (${branch.react})`)

        const fixture = compile(branch, branch.id, FIXTURE)
        expect(
            fixture.ok,
            `${branch.id}: package types compile`,
            fixture.output,
        )

        const accepts = compile(branch, `${branch.id}-accepts`, [
            branch.accepts,
        ])
        expect(
            accepts.ok,
            `${branch.id}: accepts ${branch.accepts}`,
            accepts.output,
        )

        const rejects = compile(branch, `${branch.id}-rejects`, [
            branch.rejects,
        ])
        expect(
            !rejects.ok,
            `${branch.id}: rejects ${branch.rejects}`,
            rejects.ok
                ? 'compiled cleanly, so this branch is not resolving the types it claims'
                : '',
        )
    }
} catch (error) {
    console.error('type fixture failed to run')
    console.error(error instanceof Error ? error.message : String(error))
    failures.push('setup')
} finally {
    rmSync(work, { recursive: true, force: true })
}

if (failures.length > 0) {
    console.error(`\ntype fixture failed: ${failures.length} check(s)`)
    process.exitCode = 1
} else {
    console.log('\ntype fixture passed on both React branches')
}

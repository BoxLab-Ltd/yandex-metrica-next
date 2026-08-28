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

const PKG = '@boxlab/yandex-metrica-next'
const root = process.cwd()
const work = mkdtempSync(join(tmpdir(), 'ymn-types-'))

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

    cpSync(
        join(root, 'node_modules/typescript'),
        join(work, 'node_modules/typescript'),
        {
            recursive: true,
        },
    )

    execFileSync(
        join(root, 'node_modules/typescript/bin/tsc'),
        ['--noEmit', '-p', 'tsconfig.json'],
        {
            cwd: work,
            stdio: 'inherit',
        },
    )

    console.log('type fixture passed against the packed tarball')
} catch (error) {
    console.error('type fixture failed')
    if (error instanceof Error && 'stdout' in error) {
        const out = String(error.stdout ?? '')
        if (out) console.error(out)
    }
    process.exitCode = 1
} finally {
    rmSync(work, { recursive: true, force: true })
}

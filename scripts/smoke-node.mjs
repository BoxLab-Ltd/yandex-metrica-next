import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

// The oldest supported Node, installed with npm the way such a consumer would; peers are skipped.

const [tarball] = process.argv.slice(2)
if (!tarball) {
    console.error('usage: node scripts/smoke-node.mjs <tarball>')
    process.exit(1)
}

// /pages is left out: it imports next/router, and installing next is the e2e matrix's job.
const ENTRIES = [
    '@boxlab/yandex-metrica-next',
    '@boxlab/yandex-metrica-next/client',
    '@boxlab/yandex-metrica-next/react',
    '@boxlab/yandex-metrica-next/testing',
]

const work = mkdtempSync(join(tmpdir(), 'ymn-smoke-'))
try {
    writeFileSync(
        join(work, 'package.json'),
        JSON.stringify({ name: 'ymn-smoke', private: true }),
    )
    execFileSync(
        'npm',
        [
            'install',
            '--no-audit',
            '--no-fund',
            '--legacy-peer-deps',
            resolve(tarball),
            'react@19.2.8',
        ],
        { cwd: work, stdio: 'inherit' },
    )
    const script = `
        const entries = ${JSON.stringify(ENTRIES)}
        for (const entry of entries) require(entry)
        Promise.all(entries.map(entry => import(entry)))
            .then(() => console.log('require and import ok on Node ' + process.version))
            .catch(error => { console.error(error); process.exit(1) })
    `
    execFileSync(process.execPath, ['-e', script], {
        cwd: work,
        stdio: 'inherit',
    })
} finally {
    rmSync(work, { recursive: true, force: true })
}

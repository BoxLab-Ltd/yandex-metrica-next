import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

// A file that silently joins or leaves the tarball changes what every user installs.

const SNAPSHOT = 'test/pack-snapshot.txt'
const [tarball] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const update = process.argv.includes('--update')

if (!tarball) {
    console.error('usage: node scripts/pack-snapshot.mjs <tarball> [--update]')
    process.exit(1)
}

const files = execFileSync('tar', ['tzf', tarball], { encoding: 'utf8' })
    .split('\n')
    .filter(line => line !== '' && !line.endsWith('/'))
    .map(line => line.replace(/^package\//, ''))
    .sort()
const actual = `${files.join('\n')}\n`

if (update) {
    writeFileSync(SNAPSHOT, actual)
    console.log(`${SNAPSHOT}: ${String(files.length)} files`)
    process.exit(0)
}

const expected = readFileSync(SNAPSHOT, 'utf8')
if (actual === expected) {
    console.log(`tarball matches ${SNAPSHOT} (${String(files.length)} files)`)
    process.exit(0)
}

const before = new Set(expected.split('\n').filter(Boolean))
const after = new Set(files)
console.error(`tarball differs from ${SNAPSHOT}:`)
for (const file of after) if (!before.has(file)) console.error(`  + ${file}`)
for (const file of before) if (!after.has(file)) console.error(`  - ${file}`)
console.error(
    'If the change is intended: node scripts/pack-snapshot.mjs <tarball> --update',
)
process.exitCode = 1

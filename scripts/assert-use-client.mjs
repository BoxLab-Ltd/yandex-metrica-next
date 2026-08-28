import { readFileSync } from 'node:fs'
import process from 'node:process'

// Client subpaths must carry the directive on line 1 in BOTH builds. publint and attw
// do not check this, and losing it fails only at runtime in a consumer's app.
const CLIENT_ARTIFACTS = [
    'dist/react/index.js',
    'dist/react/index.cjs',
    'dist/pages/index.js',
    'dist/pages/index.cjs',
]

const DIRECTIVE = /^['"]use client['"];?$/

const failures = []

for (const file of CLIENT_ARTIFACTS) {
    let firstLine
    try {
        firstLine = readFileSync(file, 'utf8').split('\n', 1)[0].trim()
    } catch {
        failures.push(`${file}: missing`)
        continue
    }
    if (!DIRECTIVE.test(firstLine)) {
        failures.push(
            `${file}: line 1 is ${JSON.stringify(firstLine.slice(0, 40))}`,
        )
    }
}

if (failures.length > 0) {
    console.error("'use client' directive check failed:")
    for (const f of failures) console.error(`  ${f}`)
    console.error(
        '\nLikely cause: the entry was merged into a shared chunk, or tsdown dropped the directive.',
    )
    process.exit(1)
}

console.log(`'use client' present in ${CLIENT_ARTIFACTS.length} artifacts`)

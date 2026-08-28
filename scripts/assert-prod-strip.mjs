import { readFileSync } from 'node:fs'
import process from 'node:process'

// Diagnostics carry a few hundred lines of English prose that must not reach a production
// bundle. This check is structural, not empirical, and that is deliberate:
//
// `bun build --minify` folds the guard but does not propagate a module-level constant, so
// it reports a leak even when the shape is correct. Webpack and SWC in a real Next build do
// propagate it. Rather than bless one minifier as the oracle, this asserts the two
// properties every bundler needs in order to strip the branch:
//
//   1. the guard is a literal `process.env.NODE_ENV` comparison — the exact text bundlers
//      substitute; hiding it behind a helper defeats all of them;
//   2. the message table lives after the guard, inside the function, so it becomes
//      unreachable instead of an orphaned top-level constant.
//
// Whether the strings actually vanish is verified end to end against a real Next build.

const FILES = ['src/core/diagnostics.ts', 'src/core/mode.ts']
const failures = []

for (const file of FILES) {
    const source = readFileSync(file, 'utf8')

    if (!source.includes("process.env.NODE_ENV !== 'production'")) {
        failures.push(
            `${file}: guard must be a literal process.env.NODE_ENV comparison`,
        )
    }

    if (
        /const\s+\w+\s*=\s*\(\)\s*:\s*boolean\s*=>[\s\S]{0,80}NODE_ENV/.test(
            source,
        )
    ) {
        failures.push(
            `${file}: guard is wrapped in a helper, which bundlers cannot substitute`,
        )
    }
}

const diagnostics = readFileSync('src/core/diagnostics.ts', 'utf8')
const guardIndex = diagnostics.indexOf('if (!DEV) return null')
const tableIndex = diagnostics.indexOf('const MESSAGES')

if (guardIndex === -1) {
    failures.push(
        'src/core/diagnostics.ts: report() must bail out on !DEV before anything else',
    )
} else if (tableIndex === -1 || tableIndex < guardIndex) {
    failures.push(
        'src/core/diagnostics.ts: the message table must be declared after the guard, ' +
            'otherwise it stays a live top-level constant',
    )
}

if (failures.length > 0) {
    console.error('production strip contract violated:')
    for (const failure of failures) console.error(`  ${failure}`)
    process.exitCode = 1
} else {
    console.log(
        'production strip contract holds (literal guard, table behind it)',
    )
}

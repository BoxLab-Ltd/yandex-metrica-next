import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

// Promises a change can break while still compiling and passing every test.

const walk = dir =>
    readdirSync(dir).flatMap(entry => {
        const path = join(dir, entry)
        return statSync(path).isDirectory() ? walk(path) : [path]
    })

const isTest = path => /\.test(-d)?\.tsx?$/.test(path)
const failures = []

// core runs in node, edge and the browser; one React import makes it a client module.
for (const file of walk('src/core').filter(path => !isTest(path))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        const specifier = match[1]
        if (/^(react|react-dom|next)(\/|$)/.test(specifier)) {
            failures.push(`${file}: core must not import ${specifier}`)
        }
    }
}

// Suppressing the consent popup is a legal decision the package refuses to make for anyone.
for (const file of walk('dist').filter(path => /\.d\.c?ts$/.test(path))) {
    if (readFileSync(file, 'utf8').includes('yaDisableGDPR')) {
        failures.push(
            `${file}: yaDisableGDPR must not appear in the public types`,
        )
    }
}

// The package ships consent primitives, not compliance, and must not claim otherwise.
const FORBIDDEN = [
    /\bGDPR[- ]compliant\b/i,
    /\bcompliant with\b/i,
    /\bfully compliant\b/i,
    /\banonymi[sz](e|es|ed|ing|ation)\b/i,
    /соответству\S* 152-ФЗ/i,
    /обезличива/i,
]
const prose = [
    'README.md',
    'AGENTS.md',
    ...walk('docs').filter(path => path.endsWith('.md')),
    ...walk('src').filter(path => !isTest(path)),
]
for (const file of prose) {
    let source
    try {
        source = readFileSync(file, 'utf8')
    } catch {
        continue
    }
    for (const pattern of FORBIDDEN) {
        const match = source.match(pattern)
        if (match)
            failures.push(`${file}: forbidden legal wording "${match[0]}"`)
    }
}

// A second declaration splits the goal registry, and typed goals stop being checked on some subpaths.
const registryDeclarations = walk('src')
    .filter(path => !isTest(path))
    .filter(path =>
        /\binterface MetricaGoalRegistry\b/.test(readFileSync(path, 'utf8')),
    )
if (registryDeclarations.length !== 1) {
    failures.push(
        `interface MetricaGoalRegistry must be declared exactly once in src, found: ${
            registryDeclarations.map(path => relative('.', path)).join(', ') ||
            'none'
        }`,
    )
}

if (failures.length > 0) {
    console.error('invariants violated:')
    for (const failure of failures) console.error(`  ${failure}`)
    process.exitCode = 1
} else {
    console.log('invariants hold')
}

import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as {
    version: string
}

export default defineConfig({
    // Mirrors tsdown's `define`: without it every test touching the registry throws
    // ReferenceError: __PKG_VERSION__ is not defined.
    define: {
        __PKG_VERSION__: JSON.stringify(pkg.version),
    },
    test: {
        projects: [
            {
                // `extends: true` is the default only from Vitest 5; being explicit now
                // keeps the config identical across the upgrade.
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['src/{client,testing,types}/**/*.test.ts'],
                },
            },
        ],
    },
})

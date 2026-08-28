import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as {
    version: string
}

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/react/index.ts',
        'src/pages/index.ts',
        'src/client/index.ts',
        'src/testing/index.ts',
    ],
    // test files live next to sources; they must never reach the tarball
    format: ['esm', 'cjs'],
    platform: 'neutral',
    target: 'es2022',
    // keeps the file structure and puts 'use client' on line 1 of both builds
    unbundle: true,
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    define: {
        __PKG_VERSION__: JSON.stringify(pkg.version),
    },
})

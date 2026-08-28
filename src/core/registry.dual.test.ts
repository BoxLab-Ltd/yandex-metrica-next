import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/**
 * The registry must be shared between the ESM and CJS builds. A module-level variable
 * would give each build its own copy, and every hit would be sent twice with no diagnostic.
 * This has to run in a real Node process against dist, not through Vitest's resolver.
 */
describe('dual build', () => {
    it('shares one registry between ESM and CJS copies', () => {
        const script = `
            const cjs = require('./dist/index.cjs')
            import('./dist/index.js').then(esm => {
                const host = globalThis
                const key = cjs.REGISTRY_KEY
                if (key !== esm.REGISTRY_KEY) throw new Error('keys differ')
                host[key] = { schema: 1, marker: 'from-cjs' }
                if (host[esm.REGISTRY_KEY].marker !== 'from-cjs') throw new Error('not shared')
                console.log('shared')
            }).catch(e => { console.error(String(e)); process.exit(1) })
        `
        const out = execFileSync('node', ['-e', script], { encoding: 'utf8' })
        expect(out.trim()).toBe('shared')
    })
})

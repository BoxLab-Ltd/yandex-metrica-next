import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './url.js'

// Runs in the node project: there is no window, which is exactly the server case.
describe('normalizeUrl on the server', () => {
    it('returns null when no origin can be resolved', () => {
        expect(typeof window).toBe('undefined')
        expect(normalizeUrl('/about').url).toBeNull()
    })

    it('still works when an origin is passed explicitly', () => {
        expect(
            normalizeUrl('/about', { origin: 'https://a.example' }).url,
        ).toBe('https://a.example/about')
    })
})

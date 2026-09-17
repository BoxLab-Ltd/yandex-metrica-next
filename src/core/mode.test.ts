import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveMode } from './mode.js'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('resolveMode — counter id', () => {
    it('falls back to NEXT_PUBLIC_YANDEX_METRICA_ID', () => {
        vi.stubEnv('NEXT_PUBLIC_YANDEX_METRICA_ID', '12345678')

        expect(resolveMode({ mode: 'on' }).counterId).toBe(12345678)
    })

    it('prefers an explicit counterId over the environment', () => {
        vi.stubEnv('NEXT_PUBLIC_YANDEX_METRICA_ID', '12345678')

        expect(resolveMode({ mode: 'on', counterId: 87654321 }).counterId).toBe(
            87654321,
        )
    })

    // An unset variable arrives as the literal string in a bundle, so anything that is not
    // a counter id has to stay undefined and reach YM101 rather than YM102.
    it('ignores a value that is not a counter id', () => {
        vi.stubEnv('NEXT_PUBLIC_YANDEX_METRICA_ID', 'undefined')

        expect(resolveMode({ mode: 'on' }).counterId).toBeUndefined()
    })
})

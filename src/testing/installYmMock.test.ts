import { afterEach, describe, expect, it } from 'vitest'
import { installYmMock } from './installYmMock.js'
import { resetMetricaRegistry } from './index.js'

let mock: ReturnType<typeof installYmMock> | undefined

afterEach(() => {
    mock?.restore()
    mock = undefined
})

declare const ym: (...args: unknown[]) => void

describe('installYmMock', () => {
    it('records calls with counterId, method and args', () => {
        mock = installYmMock()
        ym(123, 'hit', 'https://example.com/a', { title: 'A' })

        expect(mock.calls).toHaveLength(1)
        expect(mock.calls[0]).toEqual({
            counterId: 123,
            method: 'hit',
            args: ['https://example.com/a', { title: 'A' }],
        })
    })

    it('holds calls until load() when the tag has not loaded', () => {
        mock = installYmMock({ loaded: false })
        ym(1, 'init', { defer: true })
        ym(1, 'hit', '/queued')

        expect(mock.calls).toHaveLength(0)
        expect(mock.queued).toHaveLength(2)

        mock.load()
        expect(mock.calls.map(c => c.method)).toEqual(['init', 'hit'])
        expect(mock.queued).toHaveLength(0)
    })

    it('exposes ym.a and ym.l so tag.js recognises the stub', () => {
        mock = installYmMock()
        const stub = (globalThis as { ym?: { a?: unknown[]; l?: number } }).ym
        expect(stub?.a).toEqual([])
        expect(typeof stub?.l).toBe('number')
    })

    it('filters by method', () => {
        mock = installYmMock()
        ym(1, 'hit', '/a')
        ym(1, 'reachGoal', 'sign-up')
        ym(1, 'hit', '/b')

        expect(mock.forMethod('hit').map(c => c.args[0])).toEqual(['/a', '/b'])
    })

    it('restore puts the previous global back', () => {
        const sentinel = () => {}
        ;(globalThis as { ym?: unknown }).ym = sentinel

        const local = installYmMock()
        expect((globalThis as { ym?: unknown }).ym).not.toBe(sentinel)
        local.restore()
        expect((globalThis as { ym?: unknown }).ym).toBe(sentinel)

        delete (globalThis as { ym?: unknown }).ym
    })
})

describe('resetMetricaRegistry', () => {
    it('removes registry state so it cannot leak between test files', () => {
        const key = Symbol.for('@boxlab/yandex-metrica-next.registry.v1')
        ;(globalThis as Record<symbol, unknown>)[key] = { schema: 1 }

        resetMetricaRegistry()

        expect((globalThis as Record<symbol, unknown>)[key]).toBeUndefined()
    })
})

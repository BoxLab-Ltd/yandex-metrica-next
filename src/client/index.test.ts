import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    composeRouterTransitionStart,
    onRouterTransitionStart,
} from './index.js'
import { setRuntime, type MetricaRuntime } from '../core/api.js'

let armed: { url: string; type: string; id: string | null }[]

const runtime = (): MetricaRuntime => ({
    counterId: 1,
    send: () => true,
    status: () => ({
        state: 'ready',
        counterId: 1,
        reason: undefined,
        pageviewsSent: 0,
        bufferedCalls: 0,
    }),
    arm: (url, type, id) => void armed.push({ url, type, id: id ?? null }),
    grant: () => {},
    revoke: () => {},
    destruct: () => {},
    clientId: () => Promise.resolve(null),
    ready: () => Promise.resolve(true),
})

beforeEach(() => {
    armed = []
    setRuntime(runtime())
})

afterEach(() => {
    setRuntime(null)
})

describe('onRouterTransitionStart', () => {
    it('arms the tracker with type and transition id', async () => {
        onRouterTransitionStart('/b', 'push', { id: 'mt-1' })
        await Promise.resolve()

        expect(armed).toEqual([{ url: '/b', type: 'push', id: 'mt-1' }])
    })

    it('survives a null event, which is the default without the experimental flag', () => {
        expect(() => onRouterTransitionStart('/b', 'push', null)).not.toThrow()
        expect(armed[0]?.id).toBeNull()
    })

    it('survives a missing event argument', () => {
        expect(() => onRouterTransitionStart('/b', 'traverse')).not.toThrow()
    })

    it('collapses a fan-out of the same transition', async () => {
        onRouterTransitionStart('/b', 'push', { id: 'mt-1' })
        onRouterTransitionStart('/b', 'push', { id: 'mt-1' })
        onRouterTransitionStart('/b', 'push', { id: 'mt-1' })

        expect(armed).toHaveLength(1)
        await Promise.resolve()
    })

    it('still arms a genuinely different transition', async () => {
        onRouterTransitionStart('/b', 'push', { id: 'mt-1' })
        onRouterTransitionStart('/c', 'push', { id: 'mt-2' })

        expect(armed).toHaveLength(2)
        await Promise.resolve()
    })

    it('never throws outward when the runtime misbehaves', () => {
        setRuntime({
            ...runtime(),
            arm: () => {
                throw new Error('boom')
            },
        })

        expect(() => onRouterTransitionStart('/b', 'push')).not.toThrow()
    })

    it('is a no-op without a runtime', () => {
        setRuntime(null)
        expect(() => onRouterTransitionStart('/b', 'push')).not.toThrow()
    })
})

describe('composeRouterTransitionStart', () => {
    it('calls every hook in order', () => {
        const order: string[] = []
        const composed = composeRouterTransitionStart(
            () => order.push('sentry'),
            () => order.push('metrica'),
        )

        composed('/b', 'push', null)
        expect(order).toEqual(['sentry', 'metrica'])
    })

    it('passes all arguments through', () => {
        const hook = vi.fn()
        composeRouterTransitionStart(hook)('/b', 'replace', { id: 'x' })
        expect(hook).toHaveBeenCalledWith('/b', 'replace', { id: 'x' })
    })

    it('keeps going when one hook throws', () => {
        const later = vi.fn()
        const composed = composeRouterTransitionStart(() => {
            throw new Error('boom')
        }, later)

        expect(() => composed('/b', 'push', null)).not.toThrow()
        expect(later).toHaveBeenCalled()
    })

    it('ignores undefined hooks', () => {
        const hook = vi.fn()
        expect(() =>
            composeRouterTransitionStart(undefined, hook)('/b', 'push'),
        ).not.toThrow()
        expect(hook).toHaveBeenCalled()
    })
})

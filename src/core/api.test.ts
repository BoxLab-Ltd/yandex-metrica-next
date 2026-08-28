import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    addFileExtension,
    destruct,
    extLink,
    file,
    getClientId,
    getStatus,
    grantConsent,
    hit,
    isReady,
    notBounce,
    params,
    reachGoal,
    reachGoalUnsafe,
    revokeConsent,
    setRuntime,
    setUserID,
    userParams,
    whenReady,
    type MetricaRuntime,
} from './api.js'
import type { MetricaEvent } from './types/events.js'

let events: MetricaEvent[]
let runtime: MetricaRuntime

beforeEach(() => {
    events = []
    runtime = {
        counterId: 1,
        send: e => {
            events.push(e)
            return true
        },
        status: () => ({
            state: 'ready',
            counterId: 1,
            reason: undefined,
            pageviewsSent: 0,
            bufferedCalls: 0,
        }),
        grant: vi.fn(),
        revoke: vi.fn(),
        destruct: vi.fn(),
        clientId: () => Promise.resolve('client-1'),
        ready: () => Promise.resolve(true),
    }
    setRuntime(runtime)
})

afterEach(() => {
    setRuntime(null)
})

describe('free functions', () => {
    it('sends a pageview with options', () => {
        hit('https://a.example/x', {
            title: 'X',
            referer: 'https://a.example/prev',
        })
        expect(events[0]).toMatchObject({
            type: 'pageview',
            url: 'https://a.example/x',
            title: 'X',
        })
    })

    it('sends a goal', () => {
        reachGoal('sign-up')
        expect(events[0]).toMatchObject({ type: 'goal', goal: 'sign-up' })
    })

    it('sends a goal with params', () => {
        reachGoal('purchase', { order_price: 990 })
        expect(events[0]).toMatchObject({
            goal: 'purchase',
            params: { order_price: 990 },
        })
    })

    it('sends a dynamic goal through the unsafe entry', () => {
        reachGoalUnsafe('computed-name')
        expect(events[0]).toMatchObject({ type: 'goal', goal: 'computed-name' })
    })

    it.each([
        [() => params({ plan: 'pro' }), 'params'],
        [() => userParams({ UserID: 7 }), 'userParams'],
        [() => setUserID(7), 'setUserID'],
        [() => notBounce(), 'notBounce'],
        [() => extLink('https://b.example'), 'extLink'],
        [() => file('/a.pdf'), 'file'],
        [() => addFileExtension('pdf'), 'addFileExtension'],
    ])('routes %#', (call, type) => {
        call()
        expect(events[0]?.type).toBe(type)
    })

    it('honours an explicit counterId', () => {
        hit('https://a.example/x', { counterId: 99 })
        expect(events[0]?.counterId).toBe(99)
    })

    it('stringifies a numeric user id', () => {
        setUserID(7)
        expect(events[0]).toMatchObject({ userId: '7' })
    })
})

describe('without a runtime', () => {
    beforeEach(() => {
        setRuntime(null)
    })

    it('drops calls instead of throwing', () => {
        expect(() => {
            hit('https://a.example/x')
            reachGoalUnsafe('x')
        }).not.toThrow()
    })

    it('reports a disabled status', () => {
        expect(getStatus()).toMatchObject({
            state: 'disabled',
            counterId: null,
        })
        expect(isReady()).toBe(false)
    })

    it('resolves getClientId with null rather than rejecting', async () => {
        await expect(getClientId()).resolves.toBeNull()
    })

    it('resolves whenReady with false rather than rejecting', async () => {
        await expect(whenReady()).resolves.toBe(false)
    })
})

describe('lifecycle passthrough', () => {
    it('forwards consent and destruct to the runtime', () => {
        grantConsent()
        revokeConsent()
        destruct()

        expect(runtime.grant).toHaveBeenCalled()
        expect(runtime.revoke).toHaveBeenCalled()
        expect(runtime.destruct).toHaveBeenCalled()
    })

    it('reads status from the runtime', () => {
        expect(getStatus().state).toBe('ready')
        expect(isReady()).toBe(true)
    })

    it('resolves the client id', async () => {
        await expect(getClientId()).resolves.toBe('client-1')
    })
})

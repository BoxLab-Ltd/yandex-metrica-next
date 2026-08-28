import { describe, expectTypeOf, it } from 'vitest'
import type { YmFunction } from './tag.js'
import type { NoReservedKeys, VisitParameters } from './params.js'

declare const ym: YmFunction

describe('YmFunction overloads', () => {
    it('accepts documented calls', () => {
        ym(1, 'init', { defer: true, triggerEvent: true, webvisor: true })
        ym(1, 'hit', 'https://a.example/x')
        ym(1, 'hit', 'https://a.example/x', { title: 'X' })
        ym(1, 'reachGoal', 'sign-up')
        ym(1, 'reachGoal', 'purchase', { order_price: 990, currency: 'RUB' })
        ym(1, 'getClientID', id => expectTypeOf(id).toEqualTypeOf<string>())
        ym(1, 'destruct')
    })

    it('rejects a hit without a url', () => {
        // @ts-expect-error hit requires a url
        ym(1, 'hit')
    })

    it('rejects an unknown method', () => {
        // @ts-expect-error reachGol is not a method
        ym(1, 'reachGol', 'x')
    })

    it('rejects init without the managed parameters', () => {
        // @ts-expect-error defer and triggerEvent are owned by the package
        ym(1, 'init', { webvisor: true })
    })

    it('rejects a counterId that is not a number', () => {
        // @ts-expect-error counterId is numeric
        ym('1', 'hit', '/x')
    })
})

describe('NoReservedKeys', () => {
    const call = <T extends VisitParameters>(p: T & NoReservedKeys<T>): void =>
        void p

    it('accepts ordinary parameters', () => {
        call({ plan: 'pro', seats: 3 })
    })

    it('rejects a reserved ecommerce key', () => {
        // @ts-expect-error `purchase` is reserved by Metrica
        call({ purchase: 'x' })
    })

    it('rejects an internal key', () => {
        // @ts-expect-error `__ym` is reserved by Metrica
        call({ __ym: 1 })
    })
})

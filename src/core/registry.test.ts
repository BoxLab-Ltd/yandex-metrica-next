import { afterEach, describe, expect, it } from 'vitest'
import { REGISTRY_KEY } from '../index.js'
import { resetMetricaRegistry } from '../testing/index.js'
import { countCopies, getRegistry } from './registry.js'
import {
    BUFFER_LIMIT,
    createCallBuffer,
    hasForeignYm,
    installStub,
} from './stub.js'

afterEach(() => {
    resetMetricaRegistry()
    delete (globalThis as { ym?: unknown }).ym
})

describe('getRegistry', () => {
    it('creates state on globalThis under the frozen key', () => {
        const registry = getRegistry()
        expect(registry.schema).toBe(1)
        expect((globalThis as Record<symbol, unknown>)[REGISTRY_KEY]).toBe(
            registry,
        )
    })

    it('returns the same object on repeated calls', () => {
        expect(getRegistry()).toBe(getRegistry())
    })

    it('counts copies of the same version instead of collapsing them', () => {
        const registry = getRegistry()
        getRegistry()
        getRegistry()
        // A Set would report 1 here, hiding the most common pnpm duplicate case.
        expect(countCopies(registry)).toBe(3)
        expect(registry.copies.size).toBe(1)
    })
})

describe('installStub', () => {
    it('sets ym.a and ym.l', () => {
        const stub = installStub()
        expect(stub.a).toEqual([])
        expect(typeof stub.l).toBe('number')
    })

    it('queues calls into ym.a before the tag loads', () => {
        const stub = installStub()
        stub(1, 'hit', '/a')
        expect(stub.a).toHaveLength(1)
    })

    it('does not replace an existing global', () => {
        const foreign = (() => {}) as unknown as ReturnType<typeof installStub>
        ;(globalThis as { ym?: unknown }).ym = foreign
        expect(installStub()).toBe(foreign)
    })

    it('detects a foreign ym that is not our stub', () => {
        ;(globalThis as { ym?: unknown }).ym = () => {}
        expect(hasForeignYm()).toBe(true)
        delete (globalThis as { ym?: unknown }).ym
        installStub()
        expect(hasForeignYm()).toBe(false)
    })
})

describe('createCallBuffer', () => {
    const call = (n: number) => ({
        counterId: 1,
        method: 'hit',
        args: [`/p${n}`],
    })

    it('flushes in FIFO order', () => {
        const buffer = createCallBuffer()
        buffer.push(call(1))
        buffer.push(call(2))

        const sent: string[] = []
        buffer.flush(c => sent.push(String(c.args[0])))

        expect(sent).toEqual(['/p1', '/p2'])
        expect(buffer.size).toBe(0)
    })

    it('drops the oldest call at the limit', () => {
        const buffer = createCallBuffer(2)
        buffer.push(call(1))
        buffer.push(call(2))
        const { dropped } = buffer.push(call(3))

        expect(dropped?.args[0]).toBe('/p1')
        expect(buffer.size).toBe(2)
    })

    it('defaults to a bounded buffer', () => {
        const buffer = createCallBuffer()
        for (let i = 0; i < BUFFER_LIMIT + 5; i++) buffer.push(call(i))
        expect(buffer.size).toBe(BUFFER_LIMIT)
    })
})

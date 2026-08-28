import type { CounterId } from '../index.js'

export const BUFFER_LIMIT = 100

export interface YmStub {
    (...args: unknown[]): void
    a?: IArguments[]
    l?: number
}

type Host = { ym?: YmStub }

export const isBrowser = (): boolean => typeof window !== 'undefined'

/**
 * Installs the vendor stub. `ym.l` is not cosmetic: tag.js derives client load time
 * from it, so it must be set before the tag arrives.
 */
export function installStub(): YmStub {
    const host = globalThis as Host
    const existing = host.ym
    if (existing !== undefined) return existing

    const stub: YmStub = function (...args: unknown[]) {
        ;(stub.a ??= []).push(args as unknown as IArguments)
    }
    stub.a = []
    stub.l = Date.now()
    host.ym = stub
    return stub
}

export function hasForeignYm(): boolean {
    const host = globalThis as Host
    const ym = host.ym
    return ym !== undefined && ym.a === undefined
}

export type BufferedCall = {
    counterId: CounterId
    method: string
    args: unknown[]
}

export interface CallBuffer {
    readonly size: number
    push(call: BufferedCall): { dropped: BufferedCall | null }
    flush(send: (call: BufferedCall) => void): void
    clear(): void
}

/**
 * FIFO with a hard cap: an unbounded buffer on a page where the tag never loads
 * (adblock, CSP) grows for the whole session.
 */
export function createCallBuffer(limit: number = BUFFER_LIMIT): CallBuffer {
    const items: BufferedCall[] = []
    return {
        get size() {
            return items.length
        },
        push(call) {
            let dropped: BufferedCall | null = null
            if (items.length >= limit) dropped = items.shift() ?? null
            items.push(call)
            return { dropped }
        },
        flush(send) {
            while (items.length > 0) {
                const call = items.shift()
                if (call !== undefined) send(call)
            }
        },
        clear() {
            items.length = 0
        },
    }
}

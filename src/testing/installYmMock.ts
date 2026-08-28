import type { CounterId } from '../index.js'

export interface YmCall {
    counterId: CounterId
    method: string
    args: unknown[]
}

export interface YmMock {
    /** Every call that reached the global `ym`, in order. */
    readonly calls: YmCall[]
    /** Calls still sitting in the stub queue because the tag has not loaded yet. */
    readonly queued: YmCall[]
    /** Simulates tag.js finishing load: drains the queue into `calls`. */
    load(): void
    /** Calls for one method, e.g. `hits('hit')`. */
    forMethod(method: string): YmCall[]
    restore(): void
}

interface YmStub {
    (...args: unknown[]): void
    a?: IArguments[]
    l?: number
}

const toCall = (args: unknown[]): YmCall => ({
    counterId: args[0] as CounterId,
    method: String(args[1]),
    args: args.slice(2),
})

/**
 * Offline tests assert on this spy rather than on the network: intercepting
 * `mc.yandex.*` puts the real tag into a degraded state after the first hit,
 * so network assertions silently stop reflecting what the package did.
 */
export function installYmMock(options: { loaded?: boolean } = {}): YmMock {
    const previous = (globalThis as { ym?: YmStub }).ym
    const calls: YmCall[] = []
    const pending: YmCall[] = []
    let loaded = options.loaded ?? true

    const stub: YmStub = (...args: unknown[]) => {
        const call = toCall(args)
        if (loaded) calls.push(call)
        else pending.push(call)
    }
    stub.a = []
    stub.l = Date.now()
    ;(globalThis as { ym?: YmStub }).ym = stub

    return {
        calls,
        queued: pending,
        load() {
            loaded = true
            calls.push(...pending)
            pending.length = 0
        },
        forMethod(method: string) {
            return calls.filter(c => c.method === method)
        },
        restore() {
            if (previous === undefined)
                delete (globalThis as { ym?: YmStub }).ym
            else (globalThis as { ym?: YmStub }).ym = previous
            calls.length = 0
            pending.length = 0
        },
    }
}

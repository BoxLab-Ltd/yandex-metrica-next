import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    DEFAULT_INIT_TIMEOUT,
    initCounter,
    type CounterStatus,
    type BlockReason,
} from './init.js'
import {
    noscriptPixelUrl,
    resolveTagUrl,
    TAG_JS_URL,
    TAG_JS_URL_COM,
} from './loader.js'

const COUNTER = 12345678

let calls: { counterId: number; parameters: Record<string, unknown> }[]
let statuses: { status: CounterStatus; reason?: BlockReason }[]

const build = (options: Record<string, unknown> = {}) => {
    calls = []
    statuses = []
    return initCounter(
        { counterId: COUNTER, ...options },
        {
            call: (counterId, _method, parameters) =>
                void calls.push({
                    counterId,
                    parameters: parameters as unknown as Record<
                        string,
                        unknown
                    >,
                }),
            onStatusChange: (status, reason) =>
                void statuses.push({ status, reason }),
        },
    )
}

const fireReady = () => {
    document.dispatchEvent(new Event(`yacounter${String(COUNTER)}inited`))
}

beforeEach(() => {
    vi.useFakeTimers()
    document.head.querySelectorAll('script').forEach(s => s.remove())
    delete (globalThis as { ym?: unknown }).ym
    delete (globalThis as { _ym_debug?: unknown })._ym_debug
})

afterEach(() => {
    vi.useRealTimers()
})

describe('initCounter — managed parameters', () => {
    it('forces defer and triggerEvent', () => {
        build({ webvisor: true })
        expect(calls[0]?.parameters).toMatchObject({
            defer: true,
            triggerEvent: true,
            webvisor: true,
        })
    })

    it('does not let initParameters override defer', () => {
        build({
            initParameters: { defer: false, triggerEvent: false } as never,
        })
        expect(calls[0]?.parameters).toMatchObject({
            defer: true,
            triggerEvent: true,
        })
    })

    it('passes through user init parameters', () => {
        build({ initParameters: { trustedDomains: ['a.example'] } })
        expect(calls[0]?.parameters).toMatchObject({
            trustedDomains: ['a.example'],
        })
    })

    it('omits feature flags that were not requested', () => {
        build()
        expect(calls[0]?.parameters).not.toHaveProperty('webvisor')
    })
})

describe('initCounter — tag insertion', () => {
    it('inserts the tag before calling init', () => {
        const order: string[] = []
        const createElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation(tag => {
            if (tag === 'script') order.push('createElement')
            return createElement(tag)
        })
        const append = vi
            .spyOn(document.head, 'append')
            .mockImplementation(() => {
                order.push('append')
            })

        initCounter(
            { counterId: COUNTER },
            { call: () => void order.push('init') },
        )

        expect(order).toEqual(['createElement', 'append', 'init'])
        append.mockRestore()
        vi.mocked(document.createElement).mockRestore()
    })

    it('installs the ym stub before inserting the tag', () => {
        build()
        const stub = (globalThis as { ym?: { a?: unknown[]; l?: number } }).ym
        expect(stub?.a).toBeDefined()
        expect(typeof stub?.l).toBe('number')
    })

    it('sets nonce as an attribute', () => {
        build({ nonce: 'abc123' })
        expect(
            document.head.querySelector('script')?.getAttribute('nonce'),
        ).toBe('abc123')
    })

    it.each([null, undefined, ''])(
        'does not write the nonce attribute for %s',
        value => {
            build({ nonce: value })
            expect(
                document.head.querySelector('script')?.hasAttribute('nonce'),
            ).toBe(false)
        },
    )

    it('does not insert the tag twice for the same src', () => {
        build()
        build()
        expect(
            document.head.querySelectorAll(`script[src="${TAG_JS_URL}"]`),
        ).toHaveLength(1)
    })

    it('sets _ym_debug before insertion when debug is on', () => {
        build({ debug: true })
        expect((globalThis as { _ym_debug?: boolean })._ym_debug).toBe(true)
    })
})

describe('initCounter — consent gate', () => {
    it('inserts nothing and calls nothing when consent is denied', () => {
        const handle = build({ consent: 'denied' })

        expect(calls).toHaveLength(0)
        expect(document.head.querySelector('script')).toBeNull()
        expect(handle.status).toBe('consent-pending')
        expect(handle.reason).toBe('consent-denied')
    })

    it('starts once consent is granted', () => {
        const handle = build({ consent: 'denied' })
        handle.grant()

        expect(calls).toHaveLength(1)
        expect(handle.status).toBe('loading')
    })

    it('grant is a no-op when consent was already granted', () => {
        const handle = build()
        handle.grant()
        expect(calls).toHaveLength(1)
    })
})

describe('initCounter — readiness and failure', () => {
    it('reaches ready on the vendor init event', () => {
        const handle = build()
        expect(handle.status).toBe('loading')

        fireReady()
        expect(handle.status).toBe('ready')
    })

    it('blocks with a timeout reason when the tag never initialises', () => {
        const handle = build()
        vi.advanceTimersByTime(DEFAULT_INIT_TIMEOUT + 1)

        expect(handle.status).toBe('blocked')
        expect(handle.reason).toBe('timeout')
    })

    it('does not time out after readiness', () => {
        const handle = build()
        fireReady()
        vi.advanceTimersByTime(DEFAULT_INIT_TIMEOUT + 1)

        expect(handle.status).toBe('ready')
    })

    it('rejects an invalid counter id', () => {
        const handle = build({ counterId: 0 })
        expect(handle.status).toBe('blocked')
        expect(handle.reason).toBe('no-counter-id')
        expect(calls).toHaveLength(0)
    })

    it('reports every status transition', () => {
        build()
        fireReady()
        expect(statuses.map(s => s.status)).toEqual(['loading', 'ready'])
    })
})

describe('tag urls', () => {
    it('defaults to the ru domain', () => {
        expect(resolveTagUrl()).toBe(TAG_JS_URL)
    })

    it('switches to com on request', () => {
        expect(resolveTagUrl({ domain: 'com' })).toBe(TAG_JS_URL_COM)
    })

    it('honours an explicit scriptSrc', () => {
        expect(resolveTagUrl({ scriptSrc: 'https://cdn.example/tag.js' })).toBe(
            'https://cdn.example/tag.js',
        )
    })

    it('builds the noscript pixel for both domains', () => {
        expect(noscriptPixelUrl(COUNTER)).toBe(
            `https://mc.yandex.ru/watch/${String(COUNTER)}`,
        )
        expect(noscriptPixelUrl(COUNTER, { domain: 'com' })).toBe(
            `https://mc.yandex.com/watch/${String(COUNTER)}`,
        )
    })
})

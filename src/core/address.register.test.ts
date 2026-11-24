import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Diagnostic } from './diagnostics.js'
import type { MetricaConfig } from './register.js'
import { register } from './register.js'
import { getStatus, grantConsent, setRuntime } from './api.js'
import {
    installYmMock,
    resetMetricaRegistry,
    type YmMock,
} from '../testing/index.js'

const COUNTER = 12345678
const LANDING = '/landing?utm_source=x&q=1&utm_medium=y#reviews'

let mock: YmMock
let handles: { dispose(): void }[] = []

const start = (config: MetricaConfig = {}) => {
    const handle = register({
        counterId: COUNTER,
        mode: 'on',
        devWarnings: false,
        cleanAddressParams: 'utm',
        ...config,
    })
    handles.push(handle)
    return handle
}

const fireReady = () => {
    document.dispatchEvent(new Event(`yacounter${String(COUNTER)}inited`))
}

const hits = () => mock.forMethod('hit')

const hitOptions = (index: number) =>
    hits()[index]?.args[1] as { callback?: () => void } | undefined

/** What the tag does once the hit request has gone out. */
const confirm = (index: number) => hitOptions(index)?.callback?.()

const address = () =>
    `${window.location.pathname}${window.location.search}${window.location.hash}`

const at = (path: string, state: unknown = {}) =>
    history.replaceState(state, '', path)

beforeEach(() => {
    vi.useFakeTimers()
    resetMetricaRegistry()
    setRuntime(null)
    document.head.querySelectorAll('script').forEach(s => s.remove())
    at('/')
    mock = installYmMock()
})

afterEach(() => {
    handles.forEach(h => h.dispose())
    handles = []
    mock.restore()
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('cleanAddressParams — order', () => {
    it('removes the parameters only after the tag confirms the hit that carried them', async () => {
        at(LANDING, { custom: 1 })
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(hits()).toHaveLength(1)
        expect(hits()[0]?.args[0]).toBe(
            `${window.location.origin}/landing?utm_source=x&q=1&utm_medium=y`,
        )
        expect(address()).toBe(LANDING)

        confirm(0)

        expect(address()).toBe('/landing?q=1#reviews')
        expect(history.state).toEqual({ custom: 1 })
    })

    it('sends no second pageview for the rewritten address', async () => {
        at(LANDING)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        confirm(0)
        await vi.advanceTimersByTimeAsync(2000)

        expect(hits()).toHaveLength(1)
    })

    it('ignores the router writing the clean address back, even when every query change counts', async () => {
        at(LANDING)
        start({ pageviews: { trigger: 'url' } })
        fireReady()
        await vi.advanceTimersByTimeAsync(1000)
        confirm(0)

        // The App Router answers a userland replaceState with its own write of the same URL.
        history.replaceState({ __NA: true }, '', address())
        await vi.advanceTimersByTimeAsync(2000)

        expect(hits()).toHaveLength(1)
    })

    it('counts in getStatus()', async () => {
        at(LANDING)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        expect(getStatus()).toMatchObject({
            addressCleaning: true,
            addressCleanups: 0,
        })

        confirm(0)

        expect(getStatus()).toMatchObject({
            addressCleaning: true,
            addressCleanups: 1,
        })
    })

    it('does not write history when there is nothing to remove', async () => {
        at('/a?q=1#x')
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        const replace = vi.spyOn(history, 'replaceState')

        confirm(0)

        expect(replace).not.toHaveBeenCalled()
        expect(getStatus().addressCleanups).toBe(0)
    })

    it('is off by default and hands the tag no callback', async () => {
        at(LANDING)
        start({ cleanAddressParams: undefined })
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(hitOptions(0)).not.toHaveProperty('callback')
        expect(address()).toBe(LANDING)
        expect(getStatus().addressCleaning).toBe(false)
    })

    it('keeps the callback when beforeSend rewrites the pageview', async () => {
        at(LANDING)
        start({
            beforeSend: event =>
                event.type === 'pageview'
                    ? { ...event, title: 'rewritten' }
                    : event,
        })
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        confirm(0)

        expect(address()).toBe('/landing?q=1#reviews')
    })

    it('leaves the address alone when beforeSend cancels the pageview', async () => {
        at(LANDING)
        start({
            beforeSend: event => (event.type === 'pageview' ? null : event),
        })
        fireReady()
        await vi.advanceTimersByTimeAsync(10_000)

        expect(hits()).toHaveLength(0)
        expect(address()).toBe(LANDING)
    })

    it('does nothing after dispose', async () => {
        at(LANDING)
        const handle = start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        handle.dispose()

        confirm(0)

        expect(address()).toBe(LANDING)
    })
})

describe('cleanAddressParams — navigations', () => {
    it('cleans an address reached by client navigation after its own hit', async () => {
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        history.pushState({}, '', '/b?utm_campaign=z&x=1')
        await vi.advanceTimersByTimeAsync(500)
        expect(hits()).toHaveLength(2)
        expect(hits()[1]?.args[0]).toBe(
            `${window.location.origin}/b?utm_campaign=z&x=1`,
        )
        expect(address()).toBe('/b?utm_campaign=z&x=1')

        confirm(1)
        await vi.advanceTimersByTimeAsync(1000)

        expect(address()).toBe('/b?x=1')
        expect(hits()).toHaveLength(2)
    })

    it('leaves the address alone when the visitor has moved on before the confirmation', async () => {
        at(LANDING)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        history.pushState({}, '', '/b?utm_source=other')
        await vi.advanceTimersByTimeAsync(50)

        confirm(0)

        expect(address()).toBe('/b?utm_source=other')
        expect(getStatus().addressCleanups).toBe(0)
    })

    it('still cleans after a hash-only change on the same page', async () => {
        at(LANDING)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        history.pushState({}, '', '/landing?utm_source=x&q=1&utm_medium=y#faq')

        confirm(0)

        expect(address()).toBe('/landing?q=1#faq')
    })
})

describe('cleanAddressParams — consent, modes and a blocked tag', () => {
    it('waits for grantConsent() and the hit that follows it', async () => {
        at(LANDING)
        start({ consent: 'denied' })
        await vi.advanceTimersByTimeAsync(10_000)
        expect(hits()).toHaveLength(0)
        expect(address()).toBe(LANDING)

        grantConsent()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        expect(hits()).toHaveLength(1)
        expect(hits()[0]?.args[0]).toContain('utm_source=x')
        expect(address()).toBe(LANDING)

        confirm(0)

        expect(address()).toBe('/landing?q=1#reviews')
    })

    it('never touches the address while consent is withheld', async () => {
        at(LANDING)
        start({ consent: 'denied' })
        history.pushState({}, '', '/b?utm_source=x')
        await vi.advanceTimersByTimeAsync(30_000)

        expect(address()).toBe('/b?utm_source=x')
        expect(getStatus().addressCleanups).toBe(0)
    })

    it('does nothing at all in mode off', async () => {
        at(LANDING)
        start({ mode: 'off' })
        await vi.advanceTimersByTimeAsync(10_000)

        expect(address()).toBe(LANDING)
        expect(mock.calls).toHaveLength(0)
    })

    it('cleans after the logged hit in log mode, as production would after the sent one', async () => {
        const seen: string[] = []
        vi.spyOn(console, 'info').mockImplementation((message: unknown) => {
            if (String(message).includes(' hit '))
                seen.push(window.location.search)
        })
        at(LANDING)
        start({ mode: 'log' })
        await vi.advanceTimersByTimeAsync(500)

        expect(seen).toEqual(['?utm_source=x&q=1&utm_medium=y'])
        expect(address()).toBe('/landing?q=1#reviews')
        expect(mock.calls).toHaveLength(0)
    })

    it('cleans once the tag is declared blocked, since nothing will read the address afterwards', async () => {
        mock.restore()
        mock = installYmMock({ loaded: false })
        at(LANDING)
        start({ initTimeout: 2000 })
        await vi.advanceTimersByTimeAsync(1500)
        expect(address()).toBe(LANDING)

        await vi.advanceTimersByTimeAsync(1000)

        expect(getStatus().state).toBe('blocked')
        expect(address()).toBe('/landing?q=1#reviews')
    })

    it('cleans a later page right after its hit once the tag is blocked', async () => {
        mock.restore()
        mock = installYmMock({ loaded: false })
        start({ initTimeout: 1000 })
        await vi.advanceTimersByTimeAsync(1500)

        history.pushState({}, '', '/b?utm_source=x&x=1')
        await vi.advanceTimersByTimeAsync(500)

        expect(address()).toBe('/b?x=1')
    })
})

describe('cleanAddressParams — Next.js history state', () => {
    it('cleans the Pages Router copy of the address so back/forward does not restore it', async () => {
        const path = '/landing?utm_source=x&q=1'
        at(path, { __N: true, url: path, as: path, options: {}, key: 'k1' })
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        confirm(0)

        expect(history.state).toEqual({
            __N: true,
            url: '/landing?q=1',
            as: '/landing?q=1',
            options: {},
            key: 'k1',
        })
    })

    it('keeps the App Router marker when its history patch is not installed', async () => {
        const state = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { t: 1 } }
        at(LANDING, state)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        confirm(0)

        expect(address()).toBe('/landing?q=1#reviews')
        expect(history.state).toEqual(state)
    })

    it('goes through the App Router patch so useSearchParams follows the address', async () => {
        const state = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { t: 1 } }
        at(LANDING, state)
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        // A copy of what app-router.js installs on mount, above the package's own patch.
        const below = history.replaceState.bind(history)
        const restored: string[] = []
        history.replaceState = function (data, unused, url) {
            const record = data as Record<string, unknown> | null
            if (record?.__NA) return below(data, unused, url)
            const current = history.state as Record<string, unknown>
            if (url) restored.push(String(url))
            return below(
                {
                    ...record,
                    __NA: current.__NA,
                    __PRIVATE_NEXTJS_INTERNALS_TREE:
                        current.__PRIVATE_NEXTJS_INTERNALS_TREE,
                },
                unused,
                url,
            )
        }

        confirm(0)

        expect(restored).toEqual([
            `${window.location.origin}/landing?q=1#reviews`,
        ])
        expect(history.state).toEqual(state)
        await vi.advanceTimersByTimeAsync(1000)
        expect(hits()).toHaveLength(1)
    })
})

describe('cleanAddressParams — diagnostics', () => {
    const collect = (config: MetricaConfig) => {
        const diagnostics: Diagnostic[] = []
        vi.spyOn(console, 'info').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        start({
            devWarnings: true,
            onDiagnostic: d => void diagnostics.push(d),
            ...config,
        })
        return diagnostics
    }

    it('reports YM403 with the removed names', async () => {
        at(LANDING)
        const diagnostics = collect({})
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        confirm(0)

        expect(diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'YM403',
                level: 'info',
                message:
                    'Removed from the address bar after the hit: utm_source, utm_medium.',
            }),
        )
    })

    it.each([
        ['pageviews: false', { pageviews: false }],
        ['pageviews.first: false', { pageviews: { first: false } }],
    ] as const)(
        'reports YM105 and stays off with %s',
        async (_label, config) => {
            at(LANDING)
            const diagnostics = collect(config)
            fireReady()
            history.pushState({}, '', '/b?utm_source=x')
            await vi.advanceTimersByTimeAsync(500)
            hits().forEach((_hit, index) => confirm(index))

            expect(diagnostics.map(d => d.code)).toContain('YM105')
            expect(getStatus().addressCleaning).toBe(false)
            expect(address()).toBe('/b?utm_source=x')
        },
    )

    it('says nothing when the option is not set', () => {
        const diagnostics = collect({
            cleanAddressParams: undefined,
            pageviews: false,
        })

        expect(diagnostics.map(d => d.code)).not.toContain('YM105')
    })
})

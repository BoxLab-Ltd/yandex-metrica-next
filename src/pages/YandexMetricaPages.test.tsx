import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { setRuntime } from '../core/api.js'
import {
    installYmMock,
    resetMetricaRegistry,
    type YmMock,
} from '../testing/index.js'

type Handler = (...args: unknown[]) => void

const { routerEvents } = vi.hoisted(() => {
    const handlers = new Map<string, Set<Handler>>()
    return {
        routerEvents: {
            on(type: string, handler: Handler) {
                const set = handlers.get(type) ?? new Set<Handler>()
                set.add(handler)
                handlers.set(type, set)
            },
            off(type: string, handler: Handler) {
                handlers.get(type)?.delete(handler)
            },
            emit(type: string, ...args: unknown[]) {
                for (const handler of [...(handlers.get(type) ?? [])])
                    handler(...args)
            },
        },
    }
})

vi.mock('next/router', () => ({ default: { events: routerEvents } }))

const { YandexMetricaPages } = await import('./YandexMetricaPages.js')

const COUNTER = 12345678

let mock: YmMock

const fireReady = () => {
    document.dispatchEvent(new Event(`yacounter${String(COUNTER)}inited`))
}

const mount = () =>
    render(
        <YandexMetricaPages
            counterId={COUNTER}
            mode='on'
            devWarnings={false}
        />,
    )

beforeEach(() => {
    vi.useFakeTimers()
    resetMetricaRegistry()
    setRuntime(null)
    document.head.querySelectorAll('script').forEach(s => s.remove())
    history.replaceState({}, '', '/')
    mock = installYmMock()
})

afterEach(() => {
    cleanup()
    mock.restore()
    setRuntime(null)
    vi.useRealTimers()
})

describe('YandexMetricaPages', () => {
    it('initialises the counter and sends the first pageview', async () => {
        mount()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('init')).toHaveLength(1)
        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('sends a pageview for a completed route change', async () => {
        mount()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        // Next writes history inside changeState and only then emits the completion.
        history.pushState({}, '', '/b')
        routerEvents.emit('routeChangeComplete', '/b', { shallow: false })
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(2)
    })

    it('sends nothing for a cancelled route change', async () => {
        mount()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        // A cancellation is reported before changeState, so no history write happens.
        routerEvents.emit(
            'routeChangeError',
            Object.assign(new Error('Route Cancelled'), { cancelled: true }),
            '/b',
            { shallow: false },
        )
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('ignores a shallow change that only touches the query', async () => {
        mount()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        history.pushState({}, '', '/?tab=2')
        routerEvents.emit('routeChangeComplete', '/?tab=2', { shallow: true })
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('renders the noscript pixel', () => {
        const { container } = mount()

        expect(container.querySelector('noscript')).not.toBeNull()
    })
})

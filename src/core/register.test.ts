import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { register } from './register.js'
import { getRegistry } from './registry.js'
import { getStatus, isReady, setRuntime } from './api.js'
import {
    installYmMock,
    resetMetricaRegistry,
    type YmMock,
} from '../testing/index.js'

const COUNTER = 12345678

let mock: YmMock
let handles: { dispose(): void }[] = []

const start = (config: Record<string, unknown> = {}) => {
    const handle = register({
        counterId: COUNTER,
        mode: 'on',
        devWarnings: false,
        ...config,
    })
    handles.push(handle)
    return handle
}

const fireReady = () => {
    document.dispatchEvent(new Event(`yacounter${String(COUNTER)}inited`))
}

beforeEach(() => {
    vi.useFakeTimers()
    resetMetricaRegistry()
    setRuntime(null)
    document.head.querySelectorAll('script').forEach(s => s.remove())
    history.replaceState({}, '', '/')
    mock = installYmMock()
})

afterEach(() => {
    handles.forEach(h => h.dispose())
    handles = []
    mock.restore()
    vi.useRealTimers()
})

describe('register — assembly', () => {
    it('initialises the counter and sends the first pageview', async () => {
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('init')).toHaveLength(1)
        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('tracks navigations after the first pageview', async () => {
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        history.pushState({}, '', '/next')
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(2)
    })

    it('exposes status through the shared api', () => {
        start()
        fireReady()
        expect(getStatus().counterId).toBe(COUNTER)
        expect(isReady()).toBe(true)
    })

    it('can run without pageview tracking', async () => {
        start({ pageviews: false })
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(0)
        expect(mock.forMethod('init')).toHaveLength(1)
    })
})

describe('register — guards', () => {
    it('reports YM301 and keeps the original tracker on a second register', async () => {
        const onDiagnostic = vi.fn()
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        const owner = getRegistry().trackerOwner
        start({ devWarnings: true, onDiagnostic })

        expect(onDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'YM301' }),
        )
        // The original tracker keeps ownership; the duplicate never takes over.
        expect(getRegistry().trackerOwner).toBe(owner)
    })

    it('does not install a second tag for a duplicate register', () => {
        start()
        start()
        expect(document.head.querySelectorAll('script')).toHaveLength(1)
    })

    it('returns a working handle for the duplicate register', () => {
        start()
        const duplicate = start()
        expect(duplicate.counterId).toBe(COUNTER)
    })

    it('refuses a missing counterId', () => {
        const handle = register({ mode: 'on', devWarnings: false })
        expect(handle.counterId).toBeNull()
        expect(mock.calls).toHaveLength(0)
    })

    it('refuses an invalid counterId', () => {
        const handle = register({
            counterId: -1,
            mode: 'on',
            devWarnings: false,
        })
        expect(handle.counterId).toBeNull()
    })

    it('does nothing at all in off mode', () => {
        const handle = register({ counterId: COUNTER, mode: 'off' })
        expect(handle.counterId).toBeNull()
        expect(mock.calls).toHaveLength(0)
    })
})

describe('register — log mode', () => {
    it('loads no tag and sends nothing', async () => {
        const log = vi.fn()
        start({ mode: 'log' })
        await vi.advanceTimersByTimeAsync(500)

        expect(document.head.querySelector('script')).toBeNull()
        expect(mock.calls).toHaveLength(0)
        void log
    })
})

describe('register — dispose', () => {
    it('detaches the tracker without destructing the counter', async () => {
        const handle = start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        const before = mock.forMethod('hit').length

        handle.dispose()
        history.pushState({}, '', '/after-dispose')
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(before)
        // destruct is never called implicitly: a re-init of the same counter is not guaranteed.
        expect(mock.forMethod('destruct')).toHaveLength(0)
    })

    it('allows a fresh register after dispose', async () => {
        start().dispose()
        start()
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('init').length).toBeGreaterThanOrEqual(1)
    })
})

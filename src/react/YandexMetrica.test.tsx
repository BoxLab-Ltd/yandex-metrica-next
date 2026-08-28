import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { YandexMetrica } from './YandexMetrica.js'
import { setRuntime } from '../core/api.js'
import {
    installYmMock,
    resetMetricaRegistry,
    type YmMock,
} from '../testing/index.js'

const COUNTER = 12345678

let mock: YmMock

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
    cleanup()
    mock.restore()
    setRuntime(null)
    vi.useRealTimers()
})

describe('YandexMetrica — mounting', () => {
    it('initialises the counter', async () => {
        render(
            <YandexMetrica counterId={COUNTER} mode='on' devWarnings={false} />,
        )
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('init')).toHaveLength(1)
    })

    it('sends one first pageview', async () => {
        render(
            <YandexMetrica counterId={COUNTER} mode='on' devWarnings={false} />,
        )
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('installs one tag and one pageview under StrictMode', async () => {
        // StrictMode mounts, unmounts and mounts again; both must stay singular.
        render(
            <StrictMode>
                <YandexMetrica
                    counterId={COUNTER}
                    mode='on'
                    devWarnings={false}
                />
            </StrictMode>,
        )
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        expect(document.head.querySelectorAll('script')).toHaveLength(1)
        expect(mock.forMethod('hit')).toHaveLength(1)
    })

    it('tracks a navigation after mount', async () => {
        render(
            <YandexMetrica counterId={COUNTER} mode='on' devWarnings={false} />,
        )
        fireReady()
        await vi.advanceTimersByTimeAsync(500)

        history.pushState({}, '', '/next')
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(2)
    })
})

describe('YandexMetrica — noscript pixel', () => {
    it('renders the pixel by default', () => {
        const { container } = render(
            <YandexMetrica
                counterId={COUNTER}
                mode='off'
                devWarnings={false}
            />,
        )
        // jsdom keeps <noscript> contents as text, not as DOM, so assert on the markup.
        const markup = container.querySelector('noscript')?.innerHTML ?? ''
        expect(markup).toContain(
            `https://mc.yandex.ru/watch/${String(COUNTER)}`,
        )
    })

    it('uses the com domain when asked', () => {
        const { container } = render(
            <YandexMetrica
                counterId={COUNTER}
                domain='com'
                mode='off'
                devWarnings={false}
            />,
        )
        expect(container.querySelector('noscript')?.innerHTML ?? '').toContain(
            'mc.yandex.com',
        )
    })

    it('can be turned off', () => {
        const { container } = render(
            <YandexMetrica
                counterId={COUNTER}
                noscript={false}
                mode='off'
                devWarnings={false}
            />,
        )
        expect(container.querySelector('noscript')).toBeNull()
    })

    it('renders nothing without a counter id', () => {
        const { container } = render(
            <YandexMetrica mode='off' devWarnings={false} />,
        )
        expect(container.querySelector('noscript')).toBeNull()
    })
})

describe('YandexMetrica — unmount', () => {
    it('stops tracking but never destructs the counter', async () => {
        const { unmount } = render(
            <YandexMetrica counterId={COUNTER} mode='on' devWarnings={false} />,
        )
        fireReady()
        await vi.advanceTimersByTimeAsync(500)
        const before = mock.forMethod('hit').length

        unmount()
        history.pushState({}, '', '/after-unmount')
        await vi.advanceTimersByTimeAsync(500)

        expect(mock.forMethod('hit')).toHaveLength(before)
        expect(mock.forMethod('destruct')).toHaveLength(0)
    })
})

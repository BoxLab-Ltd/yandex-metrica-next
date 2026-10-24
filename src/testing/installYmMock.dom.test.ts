// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installYmMock, resetMetricaRegistry, type YmMock } from './index.js'
import { register } from '../client/index.js'
import { reachGoal } from '../index.js'

let mock: YmMock | undefined

afterEach(() => {
    mock?.restore()
    mock = undefined
    resetMetricaRegistry()
})

declare const ym: (...args: unknown[]) => void

const listen = (counterId: number) => {
    const ready = vi.fn()
    document.addEventListener(`yacounter${String(counterId)}inited`, ready)
    return ready
}

describe('installYmMock readiness', () => {
    it('announces readiness after init, the way a loaded tag.js does', async () => {
        mock = installYmMock()
        const ready = listen(7)

        ym(7, 'init', { defer: true })
        expect(ready).not.toHaveBeenCalled()
        await Promise.resolve()

        expect(ready).toHaveBeenCalledTimes(1)
    })

    it('announces readiness on load() for counters initialised while queued', () => {
        mock = installYmMock({ loaded: false })
        const ready = listen(8)

        ym(8, 'init', { defer: true })
        expect(ready).not.toHaveBeenCalled()
        mock.load()

        expect(ready).toHaveBeenCalledTimes(1)
    })

    it('receives the package calls with no manual readiness event', async () => {
        mock = installYmMock()
        const handle = register({
            counterId: 9,
            mode: 'on',
            pageviews: false,
            devWarnings: false,
        })

        reachGoal('sign_up')
        await Promise.resolve()

        expect(mock.forMethod('reachGoal')).toEqual([
            {
                counterId: 9,
                method: 'reachGoal',
                args: ['sign_up', undefined, undefined],
            },
        ])
        handle.dispose()
    })
})

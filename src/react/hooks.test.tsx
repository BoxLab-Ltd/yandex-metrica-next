import { act, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MetricaRuntime, MetricaStatus } from '../core/api.js'
import { resetMetricaRegistry } from '../testing/index.js'

const status = (state: MetricaStatus['state']): MetricaStatus => ({
    state,
    counterId: state === 'disabled' ? null : 1,
    reason: undefined,
    pageviewsSent: 0,
    bufferedCalls: 0,
})

const runtimeReporting = (read: () => MetricaStatus): MetricaRuntime => ({
    counterId: 1,
    send: () => true,
    status: read,
    grant: () => {},
    revoke: () => {},
    destruct: () => {},
    arm: () => {},
    clientId: () => Promise.resolve(null),
    ready: () => Promise.resolve(true),
})

afterEach(async () => {
    const { setRuntime } = await import('../core/api.js')
    setRuntime(null)
    resetMetricaRegistry()
    vi.useRealTimers()
    vi.resetModules()
})

describe('useMetricaStatus', () => {
    it('hydrates against the server status even when the client already has one', async () => {
        // The server never runs the package, so its markup always says "disabled".
        const server = await import('./hooks.js')
        const ServerStatus = () => <p>{server.useMetricaStatus().state}</p>
        const html = renderToString(<ServerStatus />)

        // On the client the tag registered before hydration: instrumentation-client runs first.
        vi.resetModules()
        const api = await import('../core/api.js')
        api.setRuntime(runtimeReporting(() => status('ready')))
        const client = await import('./hooks.js')
        const ClientStatus = () => <p>{client.useMetricaStatus().state}</p>

        const container = document.createElement('div')
        container.innerHTML = html
        const recoverable: unknown[] = []
        await act(async () => {
            hydrateRoot(container, <ClientStatus />, {
                onRecoverableError: error => recoverable.push(error),
            })
        })

        expect(recoverable).toEqual([])
        expect(container.textContent).toBe('ready')
    })

    it('re-renders every consumer when the status changes', async () => {
        vi.useFakeTimers()
        let state: MetricaStatus['state'] = 'loading'
        const api = await import('../core/api.js')
        api.setRuntime(runtimeReporting(() => status(state)))
        const { useMetricaStatus } = await import('./hooks.js')
        const Status = ({ id }: { id: string }) => (
            <p data-testid={id}>{useMetricaStatus().state}</p>
        )

        render(
            <>
                <Status id='one' />
                <Status id='two' />
            </>,
        )
        state = 'ready'
        await act(() => vi.advanceTimersByTimeAsync(300))

        expect(screen.getByTestId('one')).toHaveTextContent('ready')
        expect(screen.getByTestId('two')).toHaveTextContent('ready')
    })
})

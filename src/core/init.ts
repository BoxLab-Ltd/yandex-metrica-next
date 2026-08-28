import type { CounterId } from '../index.js'
import type { InitParameters, ManagedInitParameters } from './types/tag.js'
import type { LoadTagOptions } from './loader.js'
import { loadTag } from './loader.js'
import { installStub } from './stub.js'

export type ConsentState = 'granted' | 'denied'

export type CounterStatus =
    'idle' | 'consent-pending' | 'loading' | 'ready' | 'blocked' | 'destroyed'

export type BlockReason =
    | 'csp'
    | 'adblock'
    | 'timeout'
    | 'consent-denied'
    | 'no-counter-id'
    | 'server'

export interface InitOptions extends LoadTagOptions {
    counterId: CounterId
    consent?: ConsentState
    initParameters?: InitParameters
    webvisor?: boolean
    clickmap?: boolean
    trackLinks?: boolean
    accurateTrackBounce?: boolean | number
    ecommerce?: boolean | string
    initTimeout?: number
}

export interface InitDeps {
    call: (
        counterId: CounterId,
        method: 'init',
        parameters: InitParameters & ManagedInitParameters,
    ) => void
    onStatusChange?: (status: CounterStatus, reason?: BlockReason) => void
    onReady?: (counterId: CounterId) => void
    setTimeout?: (fn: () => void, ms: number) => number
    clearTimeout?: (handle: number) => void
}

export interface CounterHandle {
    readonly status: CounterStatus
    readonly reason: BlockReason | undefined
    /** Inserts the tag and calls init; a no-op if consent has not been granted. */
    grant(): void
    dispose(): void
}

export const DEFAULT_INIT_TIMEOUT = 5000

/**
 * `defer` and `triggerEvent` are set by the package and cannot be overridden:
 * `defer: true` stops the tag from sending its own pageview before the router settles,
 * and `triggerEvent: true` is the only documented readiness signal.
 */
const buildInitParameters = (
    options: InitOptions,
): InitParameters & ManagedInitParameters => ({
    ...options.initParameters,
    defer: true,
    triggerEvent: true,
    ...(options.clickmap === undefined ? {} : { clickmap: options.clickmap }),
    ...(options.trackLinks === undefined
        ? {}
        : { trackLinks: options.trackLinks }),
    ...(options.accurateTrackBounce === undefined
        ? {}
        : { accurateTrackBounce: options.accurateTrackBounce }),
    ...(options.webvisor === undefined ? {} : { webvisor: options.webvisor }),
    ...(options.ecommerce === undefined
        ? {}
        : { ecommerce: options.ecommerce }),
})

export function initCounter(
    options: InitOptions,
    deps: InitDeps,
): CounterHandle {
    const schedule =
        deps.setTimeout ??
        ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number)
    const cancel =
        deps.clearTimeout ?? (handle => globalThis.clearTimeout(handle))

    let status: CounterStatus = 'idle'
    let reason: BlockReason | undefined
    let timeoutHandle: number | null = null
    let readyListener: (() => void) | null = null

    const setStatus = (next: CounterStatus, why?: BlockReason): void => {
        status = next
        reason = why
        deps.onStatusChange?.(next, why)
    }

    const clearTimer = (): void => {
        if (timeoutHandle !== null) cancel(timeoutHandle)
        timeoutHandle = null
    }

    const detachReady = (): void => {
        if (readyListener !== null && typeof document !== 'undefined') {
            document.removeEventListener(
                `yacounter${String(options.counterId)}inited`,
                readyListener,
            )
        }
        readyListener = null
    }

    const start = (): void => {
        if (status !== 'idle' && status !== 'consent-pending') return

        if (typeof window === 'undefined') {
            setStatus('blocked', 'server')
            return
        }
        if (!Number.isInteger(options.counterId) || options.counterId <= 0) {
            setStatus('blocked', 'no-counter-id')
            return
        }

        setStatus('loading')
        installStub()

        readyListener = () => {
            clearTimer()
            detachReady()
            setStatus('ready')
            deps.onReady?.(options.counterId)
        }
        document.addEventListener(
            `yacounter${String(options.counterId)}inited`,
            readyListener,
            {
                once: true,
            },
        )

        loadTag(options)
        deps.call(options.counterId, 'init', buildInitParameters(options))

        timeoutHandle = schedule(() => {
            if (status === 'loading') {
                detachReady()
                // Adblock and CSP are indistinguishable from here; the caller inspects
                // securitypolicyviolation to tell them apart.
                setStatus('blocked', 'timeout')
            }
        }, options.initTimeout ?? DEFAULT_INIT_TIMEOUT)
    }

    // A denied consent means the script is never inserted and init is never called.
    // Anything softer leaves the tag running and only pretends to respect the choice.
    if ((options.consent ?? 'granted') === 'denied') {
        setStatus('consent-pending', 'consent-denied')
    } else {
        start()
    }

    return {
        get status() {
            return status
        },
        get reason() {
            return reason
        },
        grant() {
            if (status === 'consent-pending') {
                reason = undefined
                status = 'idle'
                start()
            }
        },
        dispose() {
            clearTimer()
            detachReady()
            setStatus('destroyed')
        },
    }
}

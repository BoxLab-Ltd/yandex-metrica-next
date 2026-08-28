import type { CounterId } from '../index.js'
import type { BeforeSend, MetricaEvent } from './types/events.js'
import type { InitParameters } from './types/tag.js'
import type { Diagnostic } from './diagnostics.js'
import type { MetricaMode } from './mode.js'
import type { PageviewOptions } from './pageview.js'
import type { MetricaDomain } from './loader.js'
import type { MetricaRuntime, MetricaStatus } from './api.js'
import { report } from './diagnostics.js'
import { createLogSink, resolveMode } from './mode.js'
import { getRegistry } from './registry.js'
import { createCallPipeline } from './call.js'
import { createPageviewTracker } from './pageview.js'
import { createHistorySignals } from './signals.js'
import { createTitleSettler, type TitleMode } from './title.js'
import { initCounter, type ConsentState } from './init.js'
import { setRuntime } from './api.js'
import type { BufferedCall, YmStub } from './stub.js'

export interface MetricaConfig {
    counterId?: CounterId
    devCounterId?: CounterId
    mode?: MetricaMode
    consent?: ConsentState
    initParameters?: InitParameters
    webvisor?: boolean
    clickmap?: boolean
    trackLinks?: boolean
    accurateTrackBounce?: boolean | number
    ecommerce?: boolean | string
    pageviews?: false | PageviewOptions
    title?: TitleMode
    titleTimeout?: number
    beforeSend?: BeforeSend
    scriptSrc?: string
    domain?: MetricaDomain
    nonce?: string | null
    debug?: boolean
    devWarnings?: boolean
    initTimeout?: number
    onReady?: (context: { counterId: CounterId }) => void
    onDiagnostic?: (diagnostic: Diagnostic) => void
}

export interface MetricaHandle {
    readonly counterId: CounterId | null
    status(): MetricaStatus
    /** Detaches listeners. Never calls destruct: a re-init of the same counter is not guaranteed. */
    dispose(): void
}

const METRICA_HOSTS = /mc\.yandex\.|mc\.webvisor\.|yastatic\.net/

const inIframe = (): boolean => {
    try {
        return typeof window !== 'undefined' && window.self !== window.top
    } catch {
        // A cross-origin parent throws on access, which itself means we are framed.
        return true
    }
}

const noopHandle: MetricaHandle = {
    counterId: null,
    status: () => ({
        state: 'disabled',
        counterId: null,
        reason: undefined,
        pageviewsSent: 0,
        bufferedCalls: 0,
    }),
    dispose: () => {},
}

export function register(config: MetricaConfig = {}): MetricaHandle {
    const warn = (
        code: Parameters<typeof report>[0],
        detail?: string,
    ): void => {
        report(code, {
            detail,
            enabled: config.devWarnings !== false,
            onDiagnostic: config.onDiagnostic,
        })
    }

    const resolved = resolveMode(config)
    if (resolved.mode === 'off') return noopHandle

    if (resolved.counterId === undefined) {
        warn('YM101')
        return noopHandle
    }
    if (!Number.isInteger(resolved.counterId) || resolved.counterId <= 0) {
        warn('YM102', `Received: ${String(resolved.counterId)}.`)
        return noopHandle
    }

    const counterId = resolved.counterId
    if (inIframe()) warn('YM302')
    if (resolved.foreignYm) warn('YM104')

    const registry = getRegistry()
    const existing = registry.counters.get(counterId)
    // StrictMode mounts twice; a second register must not mean a second counter.
    if (existing !== undefined && registry.trackerOwner !== null) {
        warn('YM301')
        return {
            counterId,
            status: () => currentStatus(),
            dispose: () => {},
        }
    }

    registry.counters.set(counterId, {
        counterId,
        status: 'idle',
        pageviewsSent: 0,
    })

    let pageviewsSent = 0
    let counterStatus: MetricaStatus['state'] = 'idle'
    let counterReason: MetricaStatus['reason']

    const currentStatus = (): MetricaStatus => ({
        state: counterStatus,
        counterId,
        reason: counterReason,
        pageviewsSent,
        bufferedCalls: pipeline.buffered,
    })

    const sendToTag = (call: BufferedCall): void => {
        const ym = (globalThis as { ym?: YmStub }).ym
        ym?.(call.counterId, call.method, ...call.args)
    }

    const sink =
        resolved.mode === 'log' && resolved.foreignYm
            ? () => {}
            : resolved.mode === 'log'
              ? createLogSink()
              : sendToTag

    const pipeline = createCallPipeline({
        beforeSend: config.beforeSend,
        send: sink,
        ready: resolved.mode === 'log',
        onDropped: () =>
            warn(
                'YM312',
                'The call buffer overflowed and the oldest call was dropped.',
            ),
    })

    const counter =
        resolved.mode === 'log'
            ? null
            : initCounter(
                  {
                      counterId,
                      consent: config.consent,
                      initParameters: config.initParameters,
                      webvisor: config.webvisor,
                      clickmap: config.clickmap,
                      trackLinks: config.trackLinks,
                      accurateTrackBounce: config.accurateTrackBounce,
                      ecommerce: config.ecommerce,
                      initTimeout: config.initTimeout,
                      scriptSrc: config.scriptSrc,
                      domain: config.domain,
                      nonce: config.nonce,
                      debug: config.debug,
                  },
                  {
                      call: (id, method, parameters) =>
                          void sendToTag({
                              counterId: id,
                              method,
                              args: [parameters],
                          }),
                      onStatusChange: (status, reason) => {
                          counterStatus = status
                          counterReason = reason
                          if (status === 'ready') pipeline.setReady(true)
                          if (status === 'blocked' && reason === 'timeout')
                              warn('YM201')
                      },
                      onReady: id => config.onReady?.({ counterId: id }),
                  },
              )

    if (resolved.mode === 'log') counterStatus = 'ready'

    const onCspViolation = (event: Event): void => {
        const violation = event as SecurityPolicyViolationEvent
        if (!METRICA_HOSTS.test(violation.blockedURI)) return
        warn(
            'YM202',
            `Blocked ${violation.blockedURI} by ${violation.violatedDirective}.`,
        )
    }
    if (typeof document !== 'undefined') {
        document.addEventListener('securitypolicyviolation', onCspViolation)
    }

    const signals = createHistorySignals()
    const titles = createTitleSettler({
        mode: config.title,
        timeout: config.titleTimeout,
    })
    const owner = Symbol('yandex-metrica-next.tracker')

    const pageviewOptions =
        config.pageviews === false ? null : (config.pageviews ?? {})

    const tracker =
        pageviewOptions === null
            ? null
            : createPageviewTracker(pageviewOptions, {
                  signals,
                  send: (url, context) => {
                      void titles.settle().then(title => {
                          const event: MetricaEvent = {
                              type: 'pageview',
                              counterId,
                              url,
                              title,
                              referer: context.isFirst
                                  ? documentReferrer()
                                  : undefined,
                          }
                          if (pipeline.send(event)) pageviewsSent += 1
                          if (
                              tracker !== null &&
                              tracker.commitsWithoutArm >= 2
                          )
                              warn('YM304')
                      })
                  },
                  onQuotaExceeded: () => warn('YM312'),
              })

    if (tracker !== null) {
        registry.trackerOwner = owner
        tracker.start()
        if (pageviewOptions?.first !== false && typeof window !== 'undefined') {
            tracker.trackNow(window.location.href)
        }
    }

    const runtime: MetricaRuntime = {
        counterId,
        send: event => pipeline.send(event),
        status: currentStatus,
        grant: () => counter?.grant(),
        revoke: () => {
            ;(globalThis as Record<string, unknown>)[
                `disableYaCounter${String(counterId)}`
            ] = true
            sendToTag({ counterId, method: 'destruct', args: [] })
            counterStatus = 'destroyed'
        },
        destruct: () => {
            sendToTag({ counterId, method: 'destruct', args: [] })
            counterStatus = 'destroyed'
        },
        arm: (url, navigationType, transitionId) => {
            tracker?.arm(url, navigationType, transitionId)
        },
        clientId: timeout => askTag('getClientID', timeout),
        ready: timeout =>
            counterStatus === 'ready'
                ? Promise.resolve(true)
                : new Promise(resolve => {
                      const handle = globalThis.setTimeout(
                          () => resolve(false),
                          timeout,
                      )
                      const check = (): void => {
                          if (counterStatus !== 'ready') return
                          globalThis.clearTimeout(handle)
                          document.removeEventListener(readyEvent, check)
                          resolve(true)
                      }
                      const readyEvent = `yacounter${String(counterId)}inited`
                      document.addEventListener(readyEvent, check, {
                          once: true,
                      })
                  }),
    }

    function askTag(
        method: 'getClientID',
        timeout: number,
    ): Promise<string | null> {
        return new Promise(resolve => {
            let settled = false
            const finish = (value: string | null): void => {
                if (settled) return
                settled = true
                resolve(value)
            }
            globalThis.setTimeout(() => finish(null), timeout)
            const ym = (globalThis as { ym?: YmStub }).ym
            ym?.(counterId, method, (value: string) => finish(value))
        })
    }

    function documentReferrer(): string | undefined {
        if (typeof document === 'undefined') return undefined
        return document.referrer === '' ? undefined : document.referrer
    }

    setRuntime(runtime)

    return {
        counterId,
        status: currentStatus,
        dispose() {
            tracker?.stop()
            signals.dispose()
            titles.dispose()
            counter?.dispose()
            if (typeof document !== 'undefined') {
                document.removeEventListener(
                    'securitypolicyviolation',
                    onCspViolation,
                )
            }
            if (registry.trackerOwner === owner) registry.trackerOwner = null
            registry.counters.delete(counterId)
            setRuntime(null)
        },
    }
}

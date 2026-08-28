import type { NormalizeOptions } from './url.js'
import { normalizeUrl } from './url.js'
import type { HistoryMethod, HistorySignals } from './signals.js'

export type NavigationType = 'push' | 'replace' | 'traverse' | 'unknown'

export type PageviewTrigger = 'pathname' | 'url' | 'manual'

export interface PageviewContext {
    readonly to: string
    readonly from: string | null
    readonly navigationType: NavigationType
    readonly isFirst: boolean
    readonly isBfcache: boolean
    readonly transitionId: string | null
}

export interface PageviewOptions extends NormalizeOptions {
    enabled?: boolean
    first?: boolean
    trigger?: PageviewTrigger
    navigationTypes?: readonly NavigationType[]
    trackHistoryApi?: boolean
    trackHashChanges?: boolean
    bfcache?: 'ignore' | 'always'
    commitDebounce?: number
    searchDebounce?: number
    maxPerMinute?: number
    shouldTrack?: (context: PageviewContext) => boolean
    transformUrl?: (url: string, context: PageviewContext) => string | null
}

export interface PageviewTracker {
    start(): void
    stop(): void
    /**
     * Enriches the next commit with navigationType and transitionId. `unknown` is a
     * legitimate argument: an adapter may know a navigation completed without being able
     * to name its kind, and arming is also what stops YM304 firing.
     */
    arm(
        url: string,
        navigationType: NavigationType,
        transitionId?: string | null,
    ): void
    /** Commits without waiting for a history write; used for the first pageview. */
    trackNow(url: string, navigationType?: NavigationType): void
    readonly commitsWithoutArm: number
}

export interface PageviewTrackerDeps {
    signals: HistorySignals
    send: (url: string, context: PageviewContext) => void
    onQuotaExceeded?: () => void
    now?: () => number
    setTimeout?: (fn: () => void, ms: number) => number
    clearTimeout?: (handle: number) => void
}

const DEFAULTS = {
    commitDebounce: 100,
    searchDebounce: 500,
    maxPerMinute: 60,
} as const

const ARM_WINDOW_MS = 1000

type Armed = {
    url: string
    navigationType: NavigationType
    transitionId: string | null
    at: number
}

const triggerKey = (url: string, trigger: PageviewTrigger): string => {
    const parsed = new URL(url)
    return trigger === 'url'
        ? `${parsed.origin}${parsed.pathname}${parsed.search}`
        : `${parsed.origin}${parsed.pathname}`
}

export function createPageviewTracker(
    options: PageviewOptions,
    deps: PageviewTrackerDeps,
): PageviewTracker {
    const trigger = options.trigger ?? 'pathname'
    const commitDebounce = options.commitDebounce ?? DEFAULTS.commitDebounce
    const searchDebounce = options.searchDebounce ?? DEFAULTS.searchDebounce
    const maxPerMinute = options.maxPerMinute ?? DEFAULTS.maxPerMinute
    const navigationTypes = options.navigationTypes ?? [
        'push',
        'replace',
        'traverse',
        'unknown',
    ]

    const now = deps.now ?? (() => Date.now())
    const schedule =
        deps.setTimeout ??
        ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number)
    const cancel =
        deps.clearTimeout ?? (handle => globalThis.clearTimeout(handle))

    const armLog: Armed[] = []
    const sentAt: number[] = []

    let unsubscribeCommit: (() => void) | null = null
    let unsubscribePageShow: (() => void) | null = null
    let lastTriggerKey: string | null = null
    let lastSentUrl: string | null = null
    let pendingHandle: number | null = null
    let pendingUrl: string | null = null
    let commitsWithoutArm = 0
    let isFirst = true

    const armFor = (url: string): Armed | null => {
        const key = triggerKey(url, 'url')
        const cutoff = now() - ARM_WINDOW_MS
        for (let i = armLog.length - 1; i >= 0; i--) {
            const entry = armLog[i]
            if (entry === undefined || entry.at < cutoff) break
            if (triggerKey(entry.url, 'url') === key) return entry
        }
        return null
    }

    const withinQuota = (): boolean => {
        const cutoff = now() - 60_000
        while (sentAt.length > 0 && (sentAt[0] ?? 0) < cutoff) sentAt.shift()
        return sentAt.length < maxPerMinute
    }

    const flush = (url: string, isBfcache: boolean): void => {
        pendingHandle = null
        pendingUrl = null

        const armed = armFor(url)
        const context: PageviewContext = {
            to: url,
            from: lastSentUrl,
            navigationType: armed?.navigationType ?? 'unknown',
            isFirst,
            isBfcache,
            transitionId: armed?.transitionId ?? null,
        }

        if (armed === null && !isFirst) commitsWithoutArm += 1
        if (!navigationTypes.includes(context.navigationType)) return
        if (options.shouldTrack !== undefined && !options.shouldTrack(context))
            return

        const finalUrl =
            options.transformUrl !== undefined
                ? options.transformUrl(url, context)
                : url
        if (finalUrl === null) return

        if (!withinQuota()) {
            deps.onQuotaExceeded?.()
            return
        }

        sentAt.push(now())
        lastSentUrl = finalUrl
        isFirst = false
        deps.send(finalUrl, context)
    }

    const commit = (rawUrl: string, isBfcache = false): void => {
        if (options.enabled === false) return

        const normalized = normalizeUrl(rawUrl, options)
        if (normalized.url === null) return

        const key = triggerKey(normalized.url, trigger)
        // Router init, router.refresh() and a repeat push all land here with an unchanged
        // key; one condition removes all three, so no dedicated detectors are needed.
        if (key === lastTriggerKey) return

        // A newer commit cancels the pending one: redirect() from a Server Component and a
        // double click both produce two commits 1–14 ms apart, and only the last one is real.
        if (pendingHandle !== null) cancel(pendingHandle)

        lastTriggerKey = key
        pendingUrl = normalized.url
        const debounce =
            trigger === 'url'
                ? Math.max(commitDebounce, searchDebounce)
                : commitDebounce
        pendingHandle = schedule(() => {
            if (pendingUrl !== null) flush(pendingUrl, isBfcache)
        }, debounce)
    }

    return {
        start() {
            if (unsubscribeCommit !== null) return
            unsubscribeCommit = deps.signals.onCommitSignal(
                (url, method: HistoryMethod | 'traverse') => {
                    if (
                        method !== 'traverse' &&
                        options.trackHistoryApi === false
                    )
                        return
                    commit(url)
                },
            )
            unsubscribePageShow = deps.signals.onPageShow(persisted => {
                if (!persisted || (options.bfcache ?? 'ignore') === 'ignore')
                    return
                lastTriggerKey = null
                commit(window.location.href, true)
            })
        },
        stop() {
            unsubscribeCommit?.()
            unsubscribePageShow?.()
            unsubscribeCommit = null
            unsubscribePageShow = null
            if (pendingHandle !== null) cancel(pendingHandle)
            pendingHandle = null
            pendingUrl = null
        },
        arm(url, navigationType, transitionId = null) {
            // Armed urls arrive raw — onRouterTransitionStart reports push and replace
            // relative — while commits are normalised, so an unnormalised entry either
            // throws in the URL parser or never matches the commit it belongs to.
            const normalized = normalizeUrl(url, options)
            if (normalized.url === null) return
            armLog.push({
                url: normalized.url,
                navigationType,
                transitionId,
                at: now(),
            })
            if (armLog.length > 20) armLog.shift()
        },
        trackNow(url, navigationType = 'unknown') {
            const normalized = normalizeUrl(url, options)
            if (normalized.url === null) return
            if (navigationType !== 'unknown') {
                armLog.push({
                    url: normalized.url,
                    navigationType,
                    transitionId: null,
                    at: now(),
                })
            }
            lastTriggerKey = triggerKey(normalized.url, trigger)
            flush(normalized.url, false)
        },
        get commitsWithoutArm() {
            return commitsWithoutArm
        },
    }
}

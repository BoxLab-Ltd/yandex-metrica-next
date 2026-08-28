import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createPageviewTracker,
    type PageviewContext,
    type PageviewOptions,
} from './pageview.js'
import { createHistorySignals, type HistorySignals } from './signals.js'

const ORIGIN = 'http://localhost:3000'

let signals: HistorySignals
let sent: { url: string; context: PageviewContext }[]

const build = (options: PageviewOptions = {}) => {
    sent = []
    const tracker = createPageviewTracker(
        { origin: ORIGIN, ...options },
        {
            signals,
            send: (url, context) => void sent.push({ url, context }),
        },
    )
    tracker.start()
    return tracker
}

/** Mirrors what Next does: write history, then let the debounce window elapse. */
const navigate = (path: string, method: 'push' | 'replace' = 'push') => {
    if (method === 'push') history.pushState({}, '', path)
    else history.replaceState({}, '', path)
}

const settle = (ms = 200) => vi.advanceTimersByTime(ms)

beforeEach(() => {
    vi.useFakeTimers()
    history.replaceState({}, '', '/')
    signals = createHistorySignals()
})

afterEach(() => {
    signals.dispose()
    vi.useRealTimers()
})

describe('pageview tracker — core behaviour', () => {
    it('counts A -> B -> A as three pageviews', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()
        navigate('/a')
        settle()

        expect(sent.map(s => new URL(s.url).pathname)).toEqual([
            '/a',
            '/b',
            '/a',
        ])
    })

    it('ignores a repeat push to the current url', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/a')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('ignores router.refresh(), which replaces the same url', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/a', 'replace')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('does not count a query-only change under the pathname trigger', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/a?page=2')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('counts a query-only change under the url trigger', () => {
        const tracker = build({ trigger: 'url' })
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/a?page=2')
        settle(700)

        expect(sent.map(s => s.url)).toEqual([
            `${ORIGIN}/a`,
            `${ORIGIN}/a?page=2`,
        ])
    })
})

describe('pageview tracker — cancellation', () => {
    it('reports only the final url of a Server Component redirect', () => {
        // probe 0.5: redirect() writes /redir then /b about 1 ms apart
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/redir')
        vi.advanceTimersByTime(1)
        navigate('/b', 'replace')
        settle()

        expect(sent.map(s => new URL(s.url).pathname)).toEqual(['/a', '/b'])
    })

    it('reports only the last url of a cancelled transition', () => {
        // probe 0.5: a double click produces two commits about 14 ms apart
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        vi.advanceTimersByTime(14)
        navigate('/c')
        settle()

        expect(sent.map(s => new URL(s.url).pathname)).toEqual(['/a', '/c'])
    })

    it('keeps both when the gap exceeds the debounce window', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()
        navigate('/c')
        settle()

        expect(sent).toHaveLength(3)
    })
})

describe('pageview tracker — arm enrichment', () => {
    it('marks navigation type as unknown when the hook was never called', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()

        expect(sent[1]?.context.navigationType).toBe('unknown')
    })

    it('uses the armed navigation type and transition id', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        tracker.arm(`${ORIGIN}/b`, 'push', 'mt-1')
        navigate('/b')
        settle()

        expect(sent[1]?.context.navigationType).toBe('push')
        expect(sent[1]?.context.transitionId).toBe('mt-1')
    })

    it('counts commits without arm so a missing hook re-export can be reported', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()
        navigate('/c')
        settle()

        expect(tracker.commitsWithoutArm).toBe(2)
    })

    it('does not count commits that were armed', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)

        tracker.arm(`${ORIGIN}/b`, 'push')
        navigate('/b')
        settle()

        expect(tracker.commitsWithoutArm).toBe(0)
    })
})

describe('pageview tracker — filtering', () => {
    it('honours shouldTrack', () => {
        const tracker = build({
            shouldTrack: ctx => !ctx.to.includes('/modal'),
        })
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/modal/1')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('honours transformUrl returning null', () => {
        const tracker = build({
            transformUrl: url => (url.includes('/b') ? null : url),
        })
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('honours transformUrl rewriting the url', () => {
        const tracker = build({ transformUrl: () => `${ORIGIN}/rewritten` })
        tracker.trackNow(`${ORIGIN}/a`)

        expect(sent[0]?.url).toBe(`${ORIGIN}/rewritten`)
    })

    it('filters by navigation type', () => {
        const tracker = build({ navigationTypes: ['push'] })
        tracker.trackNow(`${ORIGIN}/a`, 'push')

        tracker.arm(`${ORIGIN}/b`, 'replace')
        navigate('/b', 'replace')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('can ignore userland history writes', () => {
        const tracker = build({ trackHistoryApi: false })
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/userland')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('does nothing when disabled', () => {
        const tracker = build({ enabled: false })
        navigate('/b')
        settle()

        expect(sent).toHaveLength(0)
        void tracker
    })
})

describe('pageview tracker — quota', () => {
    it('stops sending past maxPerMinute and reports it once', () => {
        const onQuotaExceeded = vi.fn()
        sent = []
        const tracker = createPageviewTracker(
            { origin: ORIGIN, maxPerMinute: 2 },
            {
                signals,
                send: (url, context) => void sent.push({ url, context }),
                onQuotaExceeded,
            },
        )
        tracker.start()

        tracker.trackNow(`${ORIGIN}/a`)
        navigate('/b')
        settle()
        navigate('/c')
        settle()

        expect(sent).toHaveLength(2)
        expect(onQuotaExceeded).toHaveBeenCalled()
    })
})

describe('pageview tracker — lifecycle', () => {
    it('stop() detaches from history writes', () => {
        const tracker = build()
        tracker.trackNow(`${ORIGIN}/a`)
        tracker.stop()

        navigate('/b')
        settle()

        expect(sent).toHaveLength(1)
    })

    it('start() twice does not double-subscribe', () => {
        const tracker = build()
        tracker.start()
        tracker.trackNow(`${ORIGIN}/a`)

        navigate('/b')
        settle()

        expect(sent).toHaveLength(2)
    })
})

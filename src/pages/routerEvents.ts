import type { NavigationType } from '../core/pageview.js'

type RouterEventHandler = (...args: unknown[]) => void

export type PagesRouterEvent = 'routeChangeComplete' | 'routeChangeError'

export interface PagesRouterEvents {
    on(type: PagesRouterEvent, handler: RouterEventHandler): void
    off(type: PagesRouterEvent, handler: RouterEventHandler): void
}

/**
 * Pages Router writes history inside `changeState`, which Next calls before it emits
 * `routeChangeComplete` — so the pageview is already travelling the ordinary commit path
 * and this adapter never sends one itself. Arming is still needed: an unarmed commit
 * counts toward YM304, which would tell a Pages app to re-export a hook that is never
 * called there.
 *
 * `push` and `replace` are indistinguishable in the public events, so anything that is not
 * a browser traverse is reported as `unknown` rather than guessed.
 */
export function trackPagesNavigation(
    events: PagesRouterEvents,
    arm: (url: string, navigationType: NavigationType) => void,
): () => void {
    let traversing = false

    const onPopState = (): void => {
        traversing = true
    }

    const onComplete = (...args: unknown[]): void => {
        const [url] = args
        if (typeof url !== 'string') return
        arm(url, traversing ? 'traverse' : 'unknown')
        traversing = false
    }

    // A cancelled navigation is reported before `changeState` runs, so there is no pageview
    // to undo — but the traverse flag would leak into whichever navigation supersedes it.
    const onError = (): void => {
        traversing = false
    }

    const browser = typeof window !== 'undefined'
    if (browser) window.addEventListener('popstate', onPopState)
    events.on('routeChangeComplete', onComplete)
    events.on('routeChangeError', onError)

    return () => {
        if (browser) window.removeEventListener('popstate', onPopState)
        events.off('routeChangeComplete', onComplete)
        events.off('routeChangeError', onError)
    }
}

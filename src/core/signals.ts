export type HistoryMethod = 'push' | 'replace'

export interface HistorySignals {
    /** Fires on every history write and on popstate, with the resulting location. */
    onCommitSignal(
        listener: (url: string, method: HistoryMethod | 'traverse') => void,
    ): () => void
    onPageShow(listener: (persisted: boolean) => void): () => void
    dispose(): void
}

type HistoryPatch = {
    pushState: History['pushState']
    replaceState: History['replaceState']
}

/**
 * The commit signal is a history write, not the router hook: probe 0.5 showed the tracker
 * must keep working when `onRouterTransitionStart` is not re-exported at all, and that
 * every navigation — push, replace and traverse — writes history 3–7 ms after the hook.
 */
export function createHistorySignals(): HistorySignals {
    const commitListeners = new Set<
        (url: string, method: HistoryMethod | 'traverse') => void
    >()
    const pageShowListeners = new Set<(persisted: boolean) => void>()

    if (typeof window === 'undefined') {
        return {
            onCommitSignal: () => () => {},
            onPageShow: () => () => {},
            dispose: () => {},
        }
    }

    const original: HistoryPatch = {
        pushState: history.pushState.bind(history),
        replaceState: history.replaceState.bind(history),
    }

    const notify = (
        url: string | URL | null | undefined,
        method: HistoryMethod,
    ): void => {
        const target =
            url === null || url === undefined
                ? window.location.href
                : String(url)
        for (const listener of commitListeners) listener(target, method)
    }

    history.pushState = function patchedPushState(data, unused, url) {
        const result = original.pushState(data, unused, url)
        notify(url, 'push')
        return result
    }

    history.replaceState = function patchedReplaceState(data, unused, url) {
        const result = original.replaceState(data, unused, url)
        notify(url, 'replace')
        return result
    }

    const onPopState = (): void => {
        for (const listener of commitListeners)
            listener(window.location.href, 'traverse')
    }

    const onPageShowEvent = (event: PageTransitionEvent): void => {
        for (const listener of pageShowListeners) listener(event.persisted)
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('pageshow', onPageShowEvent)

    return {
        onCommitSignal(listener) {
            commitListeners.add(listener)
            return () => void commitListeners.delete(listener)
        },
        onPageShow(listener) {
            pageShowListeners.add(listener)
            return () => void pageShowListeners.delete(listener)
        },
        dispose() {
            history.pushState = original.pushState
            history.replaceState = original.replaceState
            window.removeEventListener('popstate', onPopState)
            window.removeEventListener('pageshow', onPageShowEvent)
            commitListeners.clear()
            pageShowListeners.clear()
        },
    }
}

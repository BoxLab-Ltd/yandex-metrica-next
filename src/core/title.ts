export type TitleMode = 'settle' | 'immediate' | false

export interface TitleSettlerOptions {
    mode?: TitleMode
    timeout?: number
}

export interface TitleSettler {
    /** Resolves with the title to report, or undefined when titles are disabled. */
    settle(): Promise<string | undefined>
    /** Resolves every pending wait immediately; used on pagehide. */
    flush(): void
    dispose(): void
}

export interface TitleSettlerDeps {
    setTimeout?: (fn: () => void, ms: number) => number
    clearTimeout?: (handle: number) => void
}

export const DEFAULT_TITLE_TIMEOUT = 400

/**
 * React 19 replaces the whole <title> node on every navigation, even when the text is
 * identical — probe 0.5 confirmed this. An observer attached to the node itself goes
 * silent after the first navigation, because that node is dropped from the DOM.
 * Watching document.head for childList is the only signal that keeps working.
 */
export function createTitleSettler(
    options: TitleSettlerOptions = {},
    deps: TitleSettlerDeps = {},
): TitleSettler {
    const mode = options.mode ?? 'settle'
    const timeout = options.timeout ?? DEFAULT_TITLE_TIMEOUT
    const schedule =
        deps.setTimeout ??
        ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number)
    const cancel =
        deps.clearTimeout ?? (handle => globalThis.clearTimeout(handle))

    const waiters = new Set<(title: string | undefined) => void>()
    let observer: MutationObserver | null = null

    const resolveAll = (): void => {
        const title =
            typeof document === 'undefined' ? undefined : document.title
        for (const resolve of waiters) resolve(title)
        waiters.clear()
    }

    if (
        mode === 'settle' &&
        typeof document !== 'undefined' &&
        typeof MutationObserver !== 'undefined'
    ) {
        observer = new MutationObserver(mutations => {
            if (waiters.size === 0) return
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeName === 'TITLE') {
                        resolveAll()
                        return
                    }
                }
            }
        })
        observer.observe(document.head, { childList: true })
    }

    return {
        settle() {
            if (mode === false) return Promise.resolve(undefined)
            if (mode === 'immediate' || observer === null) {
                return Promise.resolve(
                    typeof document === 'undefined'
                        ? undefined
                        : document.title,
                )
            }

            return new Promise<string | undefined>(resolve => {
                let handle: number | null = null
                const done = (title: string | undefined): void => {
                    if (handle !== null) cancel(handle)
                    resolve(title)
                }
                waiters.add(done)
                handle = schedule(() => {
                    waiters.delete(done)
                    resolve(
                        typeof document === 'undefined'
                            ? undefined
                            : document.title,
                    )
                }, timeout)
            })
        },
        flush() {
            resolveAll()
        },
        dispose() {
            observer?.disconnect()
            observer = null
            resolveAll()
        },
    }
}

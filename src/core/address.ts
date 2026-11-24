/**
 * Query parameters to remove from the address bar once the pageview that carried them has
 * been sent. `'utm'` is every `utm_*` parameter; a list takes exact names and prefixes ending
 * in `*`, compared without regard to case. Unlike `pageviews.stripParams` it never changes
 * what is reported: the hit still carries the full URL.
 */
export type CleanAddressParams = 'utm' | readonly string[] | false

export type ParamMatcher = (name: string) => boolean

export interface RemovedParams {
    url: string
    removed: string[]
}

const PRESETS = { utm: ['utm_*'] } as const

export function paramMatcher(
    option: CleanAddressParams | undefined,
): ParamMatcher | null {
    if (option === undefined || option === false) return null
    const patterns = (option === 'utm' ? PRESETS.utm : option).map(pattern =>
        pattern.toLowerCase(),
    )
    if (patterns.length === 0) return null
    const exact = patterns.filter(pattern => !pattern.endsWith('*'))
    const prefixes = patterns
        .filter(pattern => pattern.endsWith('*'))
        .map(pattern => pattern.slice(0, -1))
    return name => {
        const lower = name.toLowerCase()
        return (
            exact.includes(lower) ||
            prefixes.some(prefix => lower.startsWith(prefix))
        )
    }
}

const decodeName = (raw: string): string => {
    try {
        return decodeURIComponent(raw.replace(/\+/g, ' '))
    } catch {
        return raw
    }
}

// Raw pairs, not URLSearchParams: that would re-encode what stays, turning q=a+b into q=a%20b.
export function removeParams(
    href: string,
    matches: ParamMatcher,
): RemovedParams {
    const hashAt = href.indexOf('#')
    const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt)
    const hash = hashAt === -1 ? '' : href.slice(hashAt)
    const queryAt = beforeHash.indexOf('?')
    if (queryAt === -1) return { url: href, removed: [] }

    const removed: string[] = []
    const kept = beforeHash
        .slice(queryAt + 1)
        .split('&')
        .filter(pair => {
            const name = decodeName(pair.split('=', 1)[0] ?? '')
            if (!matches(name)) return true
            if (!removed.includes(name)) removed.push(name)
            return false
        })
    if (removed.length === 0) return { url: href, removed }

    const base = beforeHash.slice(0, queryAt)
    const query = kept.length === 0 ? '' : `?${kept.join('&')}`
    return { url: `${base}${query}${hash}`, removed }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

// The Pages Router writes `as` back on back/forward, so a stale copy returns the parameters.
export function cleanHistoryState(
    state: unknown,
    matches: ParamMatcher,
): unknown {
    if (!isRecord(state)) return state
    const next = { ...state }
    for (const key of ['as', 'url']) {
        const value = next[key]
        if (typeof value === 'string')
            next[key] = removeParams(value, matches).url
    }
    return next
}

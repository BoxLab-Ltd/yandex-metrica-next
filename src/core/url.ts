export type TrailingSlash = 'preserve' | 'always' | 'never'

export type StripParams = readonly string[] | false | 'oauth'

export interface NormalizeOptions {
    origin?: string
    basePath?: string
    trailingSlash?: TrailingSlash
    includeSearch?: boolean
    includeHash?: boolean
    stripParams?: StripParams
    maxLength?: number
}

export interface NormalizeResult {
    /** Absolute URL, or null when the input points outside the current origin. */
    url: string | null
    strippedParams: string[]
    truncated: boolean
}

export const MAX_URL_LENGTH = 2048

/**
 * Deliberately narrow. A wide deny-list silently eats `code`, `state`, `key` and `hash`,
 * which are ordinary product parameters — promo codes, geo filters, pagination —
 * and the resulting data loss is undetectable from the reports.
 */
const SECRET_PARAMS: readonly string[] = [
    'access_token',
    'id_token',
    'refresh_token',
    'password',
    'otp',
    'api_key',
    'client_secret',
    'signature',
]

const SECRET_SUFFIXES: readonly string[] = ['_token']
const SECRET_PREFIXES: readonly string[] = ['session']

/** Opt-in preset for OAuth callback routes, where these really are secrets. */
const OAUTH_PARAMS: readonly string[] = ['code', 'state', 'key', 'hash']

const isSecret = (name: string, extra: readonly string[]): boolean => {
    const lower = name.toLowerCase()
    if (SECRET_PARAMS.includes(lower)) return true
    if (extra.includes(lower)) return true
    if (SECRET_SUFFIXES.some(suffix => lower.endsWith(suffix))) return true
    return SECRET_PREFIXES.some(prefix => lower.startsWith(prefix))
}

const resolveStripList = (
    strip: StripParams | undefined,
): { enabled: boolean; extra: readonly string[] } => {
    if (strip === false) return { enabled: false, extra: [] }
    if (strip === 'oauth') return { enabled: true, extra: OAUTH_PARAMS }
    if (strip === undefined) return { enabled: true, extra: [] }
    return { enabled: true, extra: strip.map(s => s.toLowerCase()) }
}

const applyTrailingSlash = (pathname: string, mode: TrailingSlash): string => {
    if (mode === 'preserve' || pathname === '/') return pathname
    if (mode === 'always')
        return pathname.endsWith('/') ? pathname : `${pathname}/`
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

const applyBasePath = (pathname: string, basePath: string): string => {
    if (basePath === '') return pathname
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    if (pathname === base || pathname.startsWith(`${base}/`)) return pathname
    return `${base}${pathname === '/' ? '' : pathname}` || '/'
}

// Declared locally instead of pulling in @types/node: those types must never reach a
// browser package, or setTimeout starts returning NodeJS.Timeout in the published .d.ts.
declare const process: { env?: Record<string, string | undefined> } | undefined

const readEnvBasePath = (): string => {
    if (typeof process === 'undefined') return ''
    return process.env?.__NEXT_ROUTER_BASEPATH ?? ''
}

const currentOrigin = (): string | null =>
    typeof window === 'undefined' ? null : window.location.origin

/**
 * Accepts both absolute and root-relative input: `onRouterTransitionStart` reports
 * `traverse` with an absolute URL and `push`/`replace` with a relative one, while
 * history writes are relative.
 */
export function normalizeUrl(
    input: string,
    options: NormalizeOptions = {},
): NormalizeResult {
    const origin = options.origin ?? currentOrigin()
    if (origin === null)
        return { url: null, strippedParams: [], truncated: false }

    let parsed: URL
    try {
        parsed = new URL(input, origin)
    } catch {
        return { url: null, strippedParams: [], truncated: false }
    }

    if (parsed.origin !== new URL(origin).origin) {
        return { url: null, strippedParams: [], truncated: false }
    }

    const basePath = options.basePath ?? readEnvBasePath()
    parsed.pathname = applyTrailingSlash(
        applyBasePath(parsed.pathname, basePath),
        options.trailingSlash ?? 'preserve',
    )

    const strippedParams: string[] = []
    if (options.includeSearch === false) {
        parsed.search = ''
    } else {
        const { enabled, extra } = resolveStripList(options.stripParams)
        if (enabled) {
            for (const name of [...parsed.searchParams.keys()]) {
                if (isSecret(name, extra)) {
                    parsed.searchParams.delete(name)
                    if (!strippedParams.includes(name))
                        strippedParams.push(name)
                }
            }
        }
    }

    if (options.includeHash !== true) parsed.hash = ''

    const limit = options.maxLength ?? MAX_URL_LENGTH
    let url = parsed.toString()
    let truncated = false
    if (url.length > limit) {
        url = url.slice(0, limit)
        truncated = true
    }

    return { url, strippedParams, truncated }
}

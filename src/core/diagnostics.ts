import { getRegistry } from './registry.js'

export type DiagnosticCode =
    | 'YM101'
    | 'YM102'
    | 'YM104'
    | 'YM201'
    | 'YM202'
    | 'YM203'
    | 'YM301'
    | 'YM302'
    | 'YM303'
    | 'YM304'
    | 'YM312'
    | 'YM401'
    | 'YM402'

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export interface Diagnostic {
    code: DiagnosticCode
    level: DiagnosticLevel
    message: string
    docs: string
}

declare const process: { env: { NODE_ENV?: string } }
declare const __PKG_VERSION__: string

// Written as a literal member expression on purpose: bundlers replace exactly this text,
// which turns the constant into `false` and lets the whole message table be tree-shaken.
// Hiding the check inside a helper keeps the strings in every production bundle.
const DEV = process.env.NODE_ENV !== 'production'

const docsUrl = (code: DiagnosticCode): string => {
    const version =
        typeof __PKG_VERSION__ === 'string' ? __PKG_VERSION__ : 'main'
    const ref = version === '0.0.0' ? 'main' : `v${version}`
    return `https://github.com/BoxLab-Ltd/yandex-metrica-next/blob/${ref}/docs/diagnostics.md#${code.toLowerCase()}`
}

export interface ReportOptions {
    detail?: string
    /** Set false to silence output entirely, e.g. when devWarnings is off. */
    enabled?: boolean
    onDiagnostic?: (diagnostic: Diagnostic) => void
}

/**
 * Every diagnostic is printed at most once per page: a message repeated on each navigation
 * trains people to ignore the console. Production builds strip this entirely — the guard is
 * a plain NODE_ENV comparison so the consumer's bundler can eliminate the branch.
 */
export function report(
    code: DiagnosticCode,
    options: ReportOptions = {},
): Diagnostic | null {
    if (!DEV) return null
    if (options.enabled === false) return null

    const registry = getRegistry()
    if (registry.seenDiagnostics.has(code)) return null
    registry.seenDiagnostics.add(code)

    const MESSAGES: Record<
        DiagnosticCode,
        { level: DiagnosticLevel; text: string }
    > = {
        YM101: {
            level: 'error',
            text: 'counterId is not set. Pass it explicitly or set NEXT_PUBLIC_YANDEX_METRICA_ID.',
        },
        YM102: {
            level: 'error',
            text: 'counterId does not look like a Metrica counter: expected a positive integer.',
        },
        YM104: {
            level: 'warn',
            text: 'An existing window.ym was found. Log mode leaves it alone, so calls made through it are not intercepted.',
        },
        YM201: {
            level: 'error',
            text: 'The tag did not initialise within initTimeout. Likely an ad blocker, a CSP rule, or the network.',
        },
        YM202: {
            level: 'error',
            text: 'A Content Security Policy blocked a Metrica resource. Add the reported directive.',
        },
        YM203: {
            level: 'warn',
            text: 'The same counter was initialised twice. Keep a single init per counter.',
        },
        YM301: {
            level: 'error',
            text: 'A second pageview tracker tried to start. Only one can be active; the newer one was disabled.',
        },
        YM302: {
            level: 'warn',
            text: 'The counter was initialised inside an iframe. Pageviews may be attributed to the frame.',
        },
        YM303: {
            level: 'warn',
            text: 'A navigation was announced but never committed within commitTimeout, so no pageview was sent.',
        },
        YM304: {
            level: 'warn',
            text: 'Route commits are arriving with no matching onRouterTransitionStart. Re-export the hook from instrumentation-client.ts, otherwise navigationType stays "unknown".',
        },
        YM312: {
            level: 'warn',
            text: 'maxPerMinute was exceeded; further pageviews are held back for the rest of the window.',
        },
        YM401: {
            level: 'info',
            text: 'Query parameters were removed from the reported URL.',
        },
        YM402: {
            level: 'warn',
            text: 'The reported URL exceeded 2048 characters and was truncated.',
        },
    }

    const { level, text } = MESSAGES[code]
    const diagnostic: Diagnostic = {
        code,
        level,
        message:
            options.detail === undefined ? text : `${text} ${options.detail}`,
        docs: docsUrl(code),
    }

    options.onDiagnostic?.(diagnostic)

    const line = `[yandex-metrica-next] ${code}: ${diagnostic.message}\n${diagnostic.docs}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.info(line)

    return diagnostic
}

// Codes are identifiers, not prose, so keeping them outside the guard costs nothing.
export const diagnosticCodes: DiagnosticCode[] = [
    'YM101',
    'YM102',
    'YM104',
    'YM201',
    'YM202',
    'YM203',
    'YM301',
    'YM302',
    'YM303',
    'YM304',
    'YM312',
    'YM401',
    'YM402',
]

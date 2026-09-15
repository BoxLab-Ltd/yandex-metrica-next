import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test as base, expect, type Page, type Request } from '@playwright/test'

export { expect }

export const basePath = process.env.E2E_BASE_PATH ?? ''
export const counterId = Number(process.env.E2E_COUNTER_ID ?? '99999999')
export const isDev = process.env.E2E_ENV === 'dev'
export const variant = process.env.E2E_VARIANT ?? 'default'

export interface YmCall {
    counterId: number
    method: string
    args: unknown[]
    location: string
}

export interface Hit {
    counterId: number
    url: string
    title?: string
    referer?: string
    params?: unknown
}

export interface Goal {
    counterId: number
    goal: string
    params?: unknown
}

const require = createRequire(import.meta.url)
// Yandex's own npm build of the tag, pinned: offline runs, and a tag upgrade is a deliberate change.
const TAG_JS = readFileSync(require.resolve('yandex-metrica-watch/tag.js'))
const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
)

const METRICA_HOST =
    /^(?:[a-z0-9-]+\.)*(?:yandex\.[a-z.]+|webvisor\.(?:com|org)|yastatic\.net)$/

const isMetricaUrl = (raw: string): boolean => {
    try {
        return METRICA_HOST.test(new URL(raw).hostname)
    } catch {
        return false
    }
}

// tag.js hooks push() on the stub's queue instead of replacing window.ym, so this sees every call.
function spyOnYm(): void {
    let current: unknown
    Object.defineProperty(window, 'ym', {
        configurable: true,
        get: () => current,
        set(value: unknown) {
            current =
                typeof value === 'function'
                    ? new Proxy(value, {
                          apply(target, thisArg, args: unknown[]) {
                              try {
                                  const record = (
                                      window as unknown as {
                                          __ymRecord?: (payload: string) => void
                                      }
                                  ).__ymRecord
                                  void record?.(
                                      JSON.stringify(
                                          {
                                              args,
                                              location: window.location.href,
                                          },
                                          (_key, item: unknown) =>
                                              typeof item === 'function'
                                                  ? '[Function]'
                                                  : item,
                                      ),
                                  )
                              } catch {
                                  // Recording must never change what the page does.
                              }
                              return Reflect.apply(
                                  target as (...rest: unknown[]) => unknown,
                                  thisArg,
                                  args,
                              )
                          },
                      })
                    : value
        },
    })
}

export class MetricaSpy {
    readonly calls: YmCall[] = []
    readonly requests: string[] = []
    readonly errors: string[] = []
    readonly warnings: string[] = []

    constructor(
        private readonly page: Page,
        private readonly origin: string,
    ) {}

    /** A path inside the app, with the build's basePath in front. */
    path(pathname: string): string {
        return pathname.startsWith('/') && basePath !== ''
            ? `${basePath}${pathname === '/' ? '' : pathname}`
            : pathname
    }

    /** The absolute URL a pageview for this path must report. */
    url(pathname: string): string {
        return new URL(this.path(pathname), this.origin).href
    }

    forMethod(method: string): YmCall[] {
        return this.calls.filter(call => call.method === method)
    }

    hits(): Hit[] {
        return this.forMethod('hit').map(call => ({
            counterId: call.counterId,
            url: String(call.args[0]),
            ...(call.args[1] as object | undefined),
        }))
    }

    goals(): Goal[] {
        return this.forMethod('reachGoal').map(call => ({
            counterId: call.counterId,
            goal: String(call.args[0]),
            ...(call.args[1] === undefined || call.args[1] === null
                ? {}
                : { params: call.args[1] }),
        }))
    }

    reset(): void {
        this.calls.length = 0
    }

    /** Exact length and order after a grace period: a late extra hit is the duplicate we hunt. */
    async expectHits(
        expected: readonly Partial<Hit>[],
        { grace = 1000, timeout = 15_000 } = {},
    ): Promise<Hit[]> {
        if (expected.length > 0) {
            await expect
                .poll(() => this.hits().length, { timeout })
                .toBeGreaterThanOrEqual(expected.length)
        }
        await this.page.waitForTimeout(grace)
        const hits = this.hits()
        expect(hits).toEqual(
            expected.map(hit => expect.objectContaining({ counterId, ...hit })),
        )
        return hits
    }
}

export const test = base.extend<{ metrica: MetricaSpy }>({
    metrica: [
        async ({ page, context, baseURL }, use) => {
            const origin = new URL(baseURL ?? 'http://localhost').origin
            const spy = new MetricaSpy(page, origin)
            const routed = new Set<Request>()
            const seen: Request[] = []

            context.on('request', request => {
                if (isMetricaUrl(request.url())) seen.push(request)
            })

            await context.routeWebSocket(
                url => isMetricaUrl(url.href),
                socket => socket.close(),
            )
            // fulfill, never abort: an aborted request pushes the tag into retries and flakiness.
            await context.route(
                url => isMetricaUrl(url.href),
                async route => {
                    const request = route.request()
                    routed.add(request)
                    const url = new URL(request.url())
                    spy.requests.push(
                        `${request.method()} ${url.host}${url.pathname}`,
                    )
                    const headers = {
                        'access-control-allow-origin': origin,
                        'access-control-allow-credentials': 'true',
                    }
                    if (request.method() === 'OPTIONS') {
                        return route.fulfill({
                            status: 204,
                            headers: {
                                ...headers,
                                'access-control-allow-methods': 'GET, POST',
                                'access-control-allow-headers': '*',
                            },
                        })
                    }
                    if (url.pathname === '/metrika/tag.js') {
                        return route.fulfill({
                            body: TAG_JS,
                            contentType: 'application/javascript',
                            headers,
                        })
                    }
                    // JSONP transport: a script is expected, and a gif here is a console error.
                    if (
                        url.pathname.endsWith('.js') ||
                        url.searchParams.has('callback')
                    ) {
                        return route.fulfill({
                            body: '',
                            contentType: 'application/javascript',
                            headers,
                        })
                    }
                    if (
                        url.pathname.startsWith('/watch/') ||
                        url.pathname.endsWith('.gif')
                    ) {
                        return route.fulfill({
                            body: PIXEL,
                            contentType: 'image/gif',
                            headers,
                        })
                    }
                    return route.fulfill({
                        body: '',
                        contentType: 'text/plain',
                        headers,
                    })
                },
            )

            page.on('pageerror', error =>
                spy.errors.push(`pageerror: ${error.message}`),
            )
            page.on('console', message => {
                if (message.type() === 'error')
                    spy.errors.push(`console.error: ${message.text()}`)
                if (message.type() === 'warning')
                    spy.warnings.push(message.text())
            })

            await page.exposeFunction('__ymRecord', (payload: string) => {
                const { args, location } = JSON.parse(payload) as {
                    args: unknown[]
                    location: string
                }
                spy.calls.push({
                    counterId: Number(args[0]),
                    method: String(args[1]),
                    args: args.slice(2),
                    location,
                })
            })
            await page.addInitScript(spyOnYm)

            await use(spy)

            if (process.env.E2E_DEBUG) {
                console.log(spy.requests.join('\n'))
                console.log(JSON.stringify(spy.calls, null, 2))
            }

            // A request refused by CSP never left the browser, so it is not a leak.
            const refusedByPolicy = new Set(['csp', 'net::ERR_BLOCKED_BY_CSP'])
            const leaked = seen
                .filter(
                    request =>
                        !routed.has(request) &&
                        !refusedByPolicy.has(
                            request.failure()?.errorText ?? '',
                        ),
                )
                .map(
                    request =>
                        `${request.url()} (${request.failure()?.errorText ?? 'no failure'})`,
                )
            expect(leaked, 'Metrica requests that bypassed the guard').toEqual(
                [],
            )
            expect(spy.errors, 'errors on the page').toEqual([])
        },
        { auto: true },
    ],
})

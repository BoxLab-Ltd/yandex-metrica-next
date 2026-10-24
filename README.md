# @boxlab/yandex-metrica-next

> **Unofficial.** Not affiliated with, endorsed by, or sponsored by Yandex.
> Yandex and Yandex Metrica are trademarks of their respective owners.

[![npm](https://img.shields.io/npm/v/@boxlab/yandex-metrica-next)](https://www.npmjs.com/package/@boxlab/yandex-metrica-next)
[![CI](https://github.com/BoxLab-Ltd/yandex-metrica-next/actions/workflows/ci.yml/badge.svg)](https://github.com/BoxLab-Ltd/yandex-metrica-next/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@boxlab/yandex-metrica-next)](./LICENSE)

Yandex Metrica (Яндекс Метрика) for Next.js, App Router and Pages Router. One pageview per page,
with the final URL and the right title — and a test suite that proves it against real Next
builds.

- **Correct SPA pageviews.** Sent when the URL is final — after redirects, after a double click,
  after React replaces `<title>`. The first page is counted once, not twice.
- **Typed goals.** Declare your goals once; a typo or a missing `order_price` is a compile error.
- **Nothing in development by default.** Outside production calls are logged, or sent to a
  separate dev counter — your reports never fill with `localhost`.
- **A consent gate that means it.** With consent denied the tag is not loaded at all.
- **CSP without a nonce.** No inline script; `metricaCsp()` returns the directives to merge.
- **Silent failures made loud.** Thirteen coded diagnostics in development, `getStatus()`
  everywhere.
- Zero runtime dependencies, ESM and CommonJS, about 5 kB brotlied, published with npm
  provenance.

## Install

```sh
npm i @boxlab/yandex-metrica-next
# or: pnpm add / bun add / yarn add
```

```sh
# .env
NEXT_PUBLIC_YANDEX_METRICA_ID=12345678
```

Pick **one** of the three setups below.

### App Router, Next 15.3+ — `instrumentation-client.ts` (recommended)

```ts
// instrumentation-client.ts, next to the app/ directory
import { register } from '@boxlab/yandex-metrica-next/client'

register({
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
})

export { onRouterTransitionStart } from '@boxlab/yandex-metrica-next/client'
```

The counter starts before hydration and nothing touches your layout. The re-export is optional —
pageviews are sent without it — but it labels each one with its navigation type.

Already using Sentry? Next reads one `onRouterTransitionStart` per file, so compose them:

```ts
import * as Sentry from '@sentry/nextjs'
import {
    composeRouterTransitionStart,
    onRouterTransitionStart as metricaRouterTransitionStart,
    register,
} from '@boxlab/yandex-metrica-next/client'

Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })
register({ webvisor: true })

export const onRouterTransitionStart = composeRouterTransitionStart(
    Sentry.captureRouterTransitionStart,
    metricaRouterTransitionStart,
)
```

### App Router, any Next 15 or 16 — the component

```tsx
// app/layout.tsx
import { YandexMetrica } from '@boxlab/yandex-metrica-next/react'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang='en'>
            <body>
                {children}
                <YandexMetrica
                    counterId={Number(
                        process.env.NEXT_PUBLIC_YANDEX_METRICA_ID,
                    )}
                    webvisor
                    clickmap
                    trackLinks
                    accurateTrackBounce
                />
            </body>
        </html>
    )
}
```

Place it **next to** `{children}`, never around it — wrapping turns your whole tree into client
components. It also renders the `<noscript>` pixel. Props must be serialisable, so `beforeSend`
and the other callbacks are only available through `register()`.

### Pages Router

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { YandexMetricaPages } from '@boxlab/yandex-metrica-next/pages'

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <YandexMetricaPages
                counterId={Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID)}
                webvisor
            />
            <Component {...pageProps} />
        </>
    )
}
```

## Goals

```ts
// metrica.d.ts — anywhere tsconfig includes
export {}

declare module '@boxlab/yandex-metrica-next' {
    interface MetricaGoalRegistry {
        'sign-up': void
        purchase: { order_price: number; currency: 'RUB' }
    }
}
```

```tsx
'use client'
import { reachGoal } from '@boxlab/yandex-metrica-next'

export function Checkout({ total }: { total: number }) {
    const pay = () => {
        reachGoal('purchase', { order_price: total, currency: 'RUB' })
        // reachGoal('purchase')   — compile error: order_price is required
        // reachGoal('purchse', …) — compile error: not a declared goal
    }
    return <button onClick={pay}>Pay</button>
}
```

Without a registry any string is accepted. `reachGoalUnsafe(name)` takes a name computed at
runtime. The free functions work from any client code; `useMetrica()` returns the same set for
code that prefers a hook — no provider is needed for either.

Also available: `hit`, `params`, `userParams`, `setUserID`, `notBounce`, `extLink`, `file`,
`addFileExtension`, `getClientId()` (resolves `null` on timeout, never rejects), `whenReady()`,
`getStatus()` and `useMetricaStatus()`.

## Development

| Where                  | Default (`mode: 'auto'`)                     |
| ---------------------- | -------------------------------------------- |
| `next build` / `start` | sends to `counterId`                         |
| `next dev`, tests      | logs every call to the console, loads no tag |
| …with `devCounterId`   | sends to `devCounterId` instead              |

A separate counter for development is the way to see real reports before deploying. `mode: 'on'`
sends everywhere, `mode: 'off'` disables the package entirely.

## Consent

```ts
register({ consent: 'denied' })

// once the visitor agrees:
import { grantConsent } from '@boxlab/yandex-metrica-next'
grantConsent()
```

While consent is denied the tag script is not inserted and nothing is sent or queued. On
`grantConsent()` the current page is counted; what happened before it is not.
`beforeSend` can rewrite or drop any event — every call goes through it. Details, including what
the package does **not** cover: [consent-and-pii.md](./docs/consent-and-pii.md).

## Content Security Policy

```ts
import { metricaCsp } from '@boxlab/yandex-metrica-next'

metricaCsp({ webvisor: true })
// { 'script-src': [...], 'connect-src': [...], 'img-src': [...], 'frame-src': [...], 'child-src': [...] }
```

Merge the lists into your existing directives — a directive repeated in one header is ignored.
[csp.md](./docs/csp.md) has a complete `proxy.ts`.

## Options

| Option                                                      | Default        | What it does                                                          |
| ----------------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `counterId`                                                 | env variable   | falls back to `NEXT_PUBLIC_YANDEX_METRICA_ID`                         |
| `devCounterId`                                              | —              | the counter used outside production                                   |
| `mode`                                                      | `'auto'`       | `'auto'`, `'on'`, `'log'`, `'off'` — see Development                  |
| `consent`                                                   | `'granted'`    | `'denied'` holds the tag back until `grantConsent()`                  |
| `webvisor`, `clickmap`, `trackLinks`, `accurateTrackBounce` | tag defaults   | the usual tag features                                                |
| `ecommerce`                                                 | —              | `true` or the name of your `dataLayer` array                          |
| `pageviews`                                                 | `{}`           | `false` disables them; options in [pageviews.md](./docs/pageviews.md) |
| `title`                                                     | `'settle'`     | wait for the new `<title>`; `'immediate'` or `false`                  |
| `beforeSend`                                                | —              | rewrite or drop any outgoing event (`register()` only)                |
| `initParameters`                                            | —              | other `init` parameters; `defer` and `triggerEvent` are the package's |
| `domain`, `scriptSrc`                                       | `'ru'`, tag.js | where the tag and the pixel come from                                 |
| `nonce`                                                     | —              | only for a CSP2 policy without `'strict-dynamic'`                     |
| `debug`                                                     | `false`        | turns on the tag's own console output                                 |
| `onReady`, `onDiagnostic`                                   | —              | callbacks (`register()` only)                                         |

## Testing your app

```ts
import {
    installYmMock,
    resetMetricaRegistry,
} from '@boxlab/yandex-metrica-next/testing'
```

`installYmMock()` replaces the tag with a recorder, so a test can assert which goals your code
sent. [testing.md](./docs/testing.md) has the full setup.

## Compatibility

Supported: Next 15 and 16, React 18.2 and 19, webpack and Turbopack, Node 20.9+.
`instrumentation-client.ts` exists from Next 15.3; on 15.0–15.2 use the component. Next 14 is not
supported.

What CI proves on every push, each cell a production build of a real app driven by Playwright:

| Next | React | Bundler   | Setup                                                                                  |
| ---- | ----- | --------- | -------------------------------------------------------------------------------------- |
| 16.4 | 19    | Turbopack | `instrumentation-client`, also with Sentry, `basePath` and a CommonJS `next.config.js` |
| 16.4 | 19    | webpack   | component                                                                              |
| 16.4 | 19    | Turbopack | Pages Router                                                                           |
| 15.5 | 19    | webpack   | component                                                                              |
| 15.5 | 18    | webpack   | component, Pages Router                                                                |

A nightly run repeats the Next 16 cells against the latest Next release.

## Documentation

- [Troubleshooting](./docs/troubleshooting.md) — why you do not see the data you expect
- [Diagnostics](./docs/diagnostics.md) — every code the package prints
- [Pageviews](./docs/pageviews.md) — when exactly a pageview is sent, and why
- [Consent and personal data](./docs/consent-and-pii.md)
- [Content Security Policy](./docs/csp.md)
- [Testing](./docs/testing.md)
- [Architecture](./docs/architecture.md)
- [Comparison with next-yandex-metrica](./docs/comparison.md), with a migration guide

## License

MIT © BoxLab Ltd

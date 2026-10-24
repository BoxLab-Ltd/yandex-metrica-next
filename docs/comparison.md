# Comparison with next-yandex-metrica

[`next-yandex-metrica`](https://www.npmjs.com/package/next-yandex-metrica) is the most installed
Metrica package for Next.js — about 1 000 downloads a week. This page compares it with this
package, cell by cell, so you can check every claim yourself.

> Snapshot taken **2026-10-24** against `next-yandex-metrica@1.2.3`, its latest release
> (2025-09-17). Every link points at a line in the `v1.2.3` tag, not at `main`. The project is not
> actively maintained — no release in thirteen months — but its author does answer issues.

## Where next-yandex-metrica is better

| Area          | next-yandex-metrica                        | This package                                                                    |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Size          | 1.5 kB minified and brotlied               | 4.9–5.2 kB, measured the same way, per installation path                        |
| API surface   | one provider, one hook, one function       | a component or `register()`, free functions, hooks, CSP helpers                 |
| Version range | `next >= 11`, `react >= 17`                | Next 15 and 16, React 18.2 and 19 — what the e2e matrix covers                  |
| Track record  | in production since 2023                   | first release in 2026                                                           |
| Script timing | `strategy` passes through to `next/script` | fixed: before hydration via instrumentation-client, after it from the component |

If you are on Next 14 or older, it is the only one of the two that installs.

## Pageviews

| Behaviour                        | next-yandex-metrica                                                                                                                                                                                                                                                                                                                                                                                                                                      | This package                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| First pageview, App Router       | sent twice: `init` without `defer` ([L55](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/components/YandexMetricaProvider.tsx#L55)) plus a `hit` on mount ([L31–35](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useTrackRouteChange.ts#L31-L35)), asserted by its own test ([L36–38](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/__tests__/useTrackRouteChange.test.ts#L36-L38)) | once: `defer: true` is forced and the tracker sends the first hit |
| URL reported, App Router         | bare `pathname`, no query, no origin ([L34](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useTrackRouteChange.ts#L34))                                                                                                                                                                                                                                                                                                          | absolute URL with the query, secret parameters stripped           |
| URL reported, Pages Router       | `asPath` with the query ([L20–22](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useTrackRouteChange.ts#L20-L22)) — a different shape from the App Router                                                                                                                                                                                                                                                                        | the same shape on both routers                                    |
| `title` and `referer` on a hit   | never passed ([L34](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useTrackRouteChange.ts#L34))                                                                                                                                                                                                                                                                                                                                  | both, with the title read after React replaces it                 |
| Router selection                 | required `router` prop ([L18](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/components/YandexMetricaProvider.tsx#L18)); a wrong value means zero pageviews                                                                                                                                                                                                                                                                            | none — the tracker reads history, which both routers write        |
| `next/router` in App Router apps | always imported ([L2](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useTrackRouteChange.ts#L2))                                                                                                                                                                                                                                                                                                                                 | only from the `/pages` entry                                      |

## Types

| Behaviour             | next-yandex-metrica                                                                                                           | This package                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Goal names            | `string` ([L20](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/hooks/useMetrica.ts#L20))                    | a registry you augment; a typo is a compile error, required parameters enforced |
| Visit and user params | `[key: string]: any` ([L4–5](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/lib/types/parameters.ts#L4-L5)) | typed values; reserved keys rejected at compile time                            |
| Exported types        | none from the package root ([index.ts](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/index.ts))            | every public type                                                               |

## Production concerns

| Behaviour             | next-yandex-metrica                                                                                                                                                      | This package                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Consent               | declined in [#19](https://github.com/v-doronin/next-yandex-metrica/issues/19)                                                                                            | `consent: 'denied'` loads no script until `grantConsent()`                     |
| CSP                   | inline snippet, no `nonce` prop ([L48](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/components/YandexMetricaProvider.tsx#L48))                       | no inline script; `metricaCsp()` builds the directives                         |
| Development traffic   | sent to the production counter — no mode switch ([provider](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/components/YandexMetricaProvider.tsx))      | logged, or sent to `devCounterId`                                              |
| A broken installation | silent no-op ([L9–11](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/lib/ym.ts#L9-L11))                                                                | thirteen coded diagnostics in development, `getStatus()` everywhere            |
| Alternative CDN       | the `<noscript>` pixel still points at `mc.yandex.ru` ([L64](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/src/components/YandexMetricaProvider.tsx#L64)) | `scriptSrc` and `domain` are separate; the pixel follows `domain`              |
| Module format         | CommonJS only, no `exports` map ([tsconfig](https://github.com/v-doronin/next-yandex-metrica/blob/v1.2.3/tsconfig.json#L4))                                              | ESM and CommonJS, `exports` map, `'use client'` in both                        |
| Tests                 | Jest with mocks, Next 14 and React 18                                                                                                                                    | unit, types against the tarball, Playwright against real Next 15 and 16 builds |
| Provenance            | none                                                                                                                                                                     | published from CI with npm provenance                                          |

## Migrating

```diff
- import { YandexMetricaProvider } from 'next-yandex-metrica'
+ import { YandexMetrica } from '@boxlab/yandex-metrica-next/react'

  export default function RootLayout({ children }) {
      return (
          <html>
              <body>
-                 <YandexMetricaProvider tagID={12345678} router='app' initParameters={{ webvisor: true }}>
-                     {children}
-                 </YandexMetricaProvider>
+                 {children}
+                 <YandexMetrica counterId={12345678} webvisor />
              </body>
          </html>
      )
  }
```

- `tagID` is `counterId`; `NEXT_PUBLIC_YANDEX_METRICA_ID` works in both, unchanged.
- The component is a sibling of `{children}`, not a wrapper, and there is no `router` prop.
- `useMetrica().reachGoal(target, params, callback)` becomes `reachGoal(goal, params, { callback })`;
  `ymEvent(...)` has a named function for every method.
- `initParameters` still exists, minus `defer` and `triggerEvent`, which the package owns.

**What changes in your numbers.** If you were on the App Router, every first page of a visit was
sent twice; whether Metrica merges such a pair is not documented. If it did not, pageviews drop by
up to one per visit after migrating, and the bounce rate moves with them. Page URLs change shape
too — absolute, with the query — so URL-based goals and filters written against bare paths need a
look. Neither change is a regression; check both before comparing the weeks either side of the
switch.

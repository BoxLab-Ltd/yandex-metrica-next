# AGENTS.md — @boxlab/yandex-metrica-next

Instructions for coding agents installing this package into a Next.js app. Full docs:
https://github.com/BoxLab-Ltd/yandex-metrica-next/tree/main/docs

## Installing

1. Remove any existing Metrica integration first: an inline `ym(...)` snippet in a layout or
   `_document`, `next/script` loading `tag.js`, or another package such as `next-yandex-metrica`.
   Two integrations on one page count every pageview twice.
2. Set `NEXT_PUBLIC_YANDEX_METRICA_ID` in `.env`. Never hard-code a production counter id in a
   public repository if the owner has not asked for it.
3. Choose exactly **one** setup:
    - App Router on Next 15.3+: `instrumentation-client.ts` at the project root (next to `app/`)
      calling `register()` from `@boxlab/yandex-metrica-next/client`, plus
      `export { onRouterTransitionStart } from '@boxlab/yandex-metrica-next/client'`.
      If the file already exports `onRouterTransitionStart` (Sentry does), combine them with
      `composeRouterTransitionStart` — never export the name twice.
    - App Router on Next 15.0–15.2, or when the user prefers it: `<YandexMetrica />` from
      `@boxlab/yandex-metrica-next/react` in the root layout, as a **sibling** of `{children}`.
      Never wrap `{children}` in it.
    - Pages Router: `<YandexMetricaPages />` from `@boxlab/yandex-metrica-next/pages` in
      `pages/_app.tsx`.
4. Do not add `'use client'` to the root layout for this package: the component is already a
   client component and works from a Server Component layout.

## Using it

- Goals: `reachGoal('name', params?)` from `@boxlab/yandex-metrica-next`, in client code. Declare
  goals by augmenting `MetricaGoalRegistry` in a `.d.ts` file (`declare module
'@boxlab/yandex-metrica-next' { interface MetricaGoalRegistry { ... } }`) so names are checked.
  Use `reachGoalUnsafe` only for names computed at runtime.
- No provider or context is needed; `useMetrica()` and the free functions read the same global
  state.
- Do not call `hit()` on route changes: pageviews are automatic. Calling it manually doubles them.
- Do not pass `defer` or `triggerEvent` in `initParameters`; the package owns both.
- Nothing is sent in `next dev` by default — calls are logged. That is expected, not a bug. Use
  `devCounterId` to send development traffic to a separate counter.
- Consent: `consent: 'denied'` plus `grantConsent()` from the root entry when the visitor agrees.
- CSP: merge `metricaCsp()` into existing directives; never append a second header or repeat a
  directive.

## Testing

In unit tests use `installYmMock()` and `resetMetricaRegistry()` from
`@boxlab/yandex-metrica-next/testing`, and register with `mode: 'on'` — under `NODE_ENV=test` the
default mode logs instead of sending.

## When it does not work

Run `getStatus()` in the browser console and read docs/troubleshooting.md. Every development
warning carries a code (`YM101`…) explained in docs/diagnostics.md.

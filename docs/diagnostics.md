# Diagnostics

Every message the package prints carries a code and a link to the section below. The codes
exist because `defer: true` is forced: with the tag told never to send a pageview on its own,
a broken installation produces **no hits at all** rather than double ones, and silence is the
hardest failure to notice.

Three properties hold for all of them:

- **Development only.** The whole message table sits behind `process.env.NODE_ENV !== 'production'`
  and is dropped by the consumer's bundler. The e2e matrix fetches the production chunks of a
  real Next build and asserts none of this text ships.
- **Once per page load.** A repeated warning trains people to ignore the console, so each code
  prints at most once; the registry remembers which ones were already shown.
- **Yours to route.** `onDiagnostic` receives each diagnostic as `{ code, level, message, docs }`
  before it is printed; `devWarnings: false` silences both. Neither exists in production — there
  the channel is `getStatus()`.

| Code            | Level | Meaning                                        |
| --------------- | ----- | ---------------------------------------------- |
| [YM101](#ym101) | error | No counter id                                  |
| [YM102](#ym102) | error | The counter id is not a counter id             |
| [YM103](#ym103) | warn  | Two copies of the package                      |
| [YM104](#ym104) | warn  | A foreign `window.ym`                          |
| [YM201](#ym201) | error | The tag never initialised                      |
| [YM202](#ym202) | error | A Content Security Policy blocked Metrica      |
| [YM301](#ym301) | error | A second pageview tracker                      |
| [YM302](#ym302) | warn  | Running inside an iframe                       |
| [YM303](#ym303) | warn  | A navigation that never committed              |
| [YM304](#ym304) | warn  | Commits without the router hook                |
| [YM312](#ym312) | warn  | Pageviews held back, or a call dropped         |
| [YM401](#ym401) | info  | Query parameters removed from the reported URL |
| [YM402](#ym402) | warn  | The reported URL was truncated                 |

---

## YM101

**counterId is not set.**

Neither the `counterId` option nor `NEXT_PUBLIC_YANDEX_METRICA_ID` held a usable value. The
environment variable is read the way bundlers substitute it, which means it has to exist **at
build time**; an unset one reaches the browser as the literal string `undefined` and counts as
absent rather than wrong.

Pass the id explicitly, or set the variable and rebuild. Nothing is sent until then:
`register()` returns a handle whose `status().state` is `disabled`.

## YM102

**counterId does not look like a Metrica counter: expected a positive integer.**

The value arrived, but it is not a positive integer — a string with whitespace, a `NaN` from
`Number(undefined)`, a placeholder left in an env file. The message names what arrived.

Nothing is sent. This is deliberate: a counter id that "almost works" would silently write to
someone else's counter, because Metrica accepts any id and answers identically for a real and
an invented one.

## YM103

**More than one copy of the package is loaded in this document.**

Two copies ended up in the dependency tree — a duplicated version under pnpm, or a CommonJS
`require` of the package next to an ESM `import`. The message lists the versions it found.

The state that matters is shared: the registry lives on `globalThis` under a frozen key, so the
counter, the runtime and the single-tracker guard are common to every copy. What is not shared
is the code itself — each copy ships its own bytes — and per-module caches such as the status
snapshot behind `useMetricaStatus`.

Find the duplicate with `npm ls @boxlab/yandex-metrica-next` or `pnpm why`, then deduplicate it
with an override. Your data is unaffected either way.

## YM104

**An existing window.ym was found.**

Log mode never replaces a global it did not install: silencing GTM or a hand-placed vendor
snippet in development is not the package's call. Calls made through that global are therefore
not intercepted and not printed.

Expected if you deliberately run the vendor snippet alongside. If you did not, you have two
installations of Metrica on the page — remove one.

## YM201

**The tag did not initialise within initTimeout.**

The script was inserted and `init` was called, but `yacounter{id}inited` — the only documented
readiness signal — never arrived within `initTimeout` (5 s by default). From inside the page an
ad blocker, a CSP rule and a dead network look the same.

Check the network tab for `mc.yandex.ru/metrika/tag.js`, look for a [YM202](#ym202) next to this
message, and try the page with the ad blocker off. Calls made meanwhile wait in a FIFO buffer of
100 and are dropped oldest-first after that.

## YM202

**A Content Security Policy blocked a Metrica resource.**

The package listens for `securitypolicyviolation` and reports the ones whose `blockedURI` belongs
to Metrica. The message names the blocked URI and the directive that refused it.

Merge `metricaCsp()` into your policy rather than appending its directives as text — a directive
repeated in one header is ignored after its first occurrence. `connect-src` needs
`https://mc.yandex.md` even when you only serve Russia: the tag calls `/cc` there for consent.

## YM301

**A second pageview tracker tried to start.**

`register()` ran again while a tracker was already active — usually both install paths at once,
the component in the layout and `register()` in `instrumentation-client.ts`.

Pick one path. The newer registration is disabled rather than allowed to double-count: it
returns a working handle for reading status, but the original tracker keeps ownership. A second
registration is not an error in itself — React StrictMode mounts twice on purpose, and that case
is silent.

## YM302

**The counter was initialised inside an iframe.**

`window.self !== window.top`. Pageviews carry the frame's URL, so reports show the embedded
document rather than the page a visitor sees. Intended for widgets; surprising for anything else.

## YM303

**A navigation was announced but nothing committed within commitTimeout.**

`onRouterTransitionStart` fired and then no history write followed for `commitTimeout` (10 s by
default) — a navigation that never rendered, or a route slower than the timeout.

A navigation interrupted by a newer one does **not** trigger this: the check asks whether
anything committed at all, not whether that particular navigation did. Raise `commitTimeout` for
genuinely slow routes; otherwise look for a route that ends in an error boundary. No pageview
was sent for that navigation.

## YM304

**Route commits are arriving with no matching onRouterTransitionStart.**

The tracker works from history writes, and the router hook only labels them, so pageviews are
sent either way — only `navigationType` degrades to `'unknown'`.

On the recommended path, re-export the hook:

```ts
export { onRouterTransitionStart } from '@boxlab/yandex-metrica-next/client'
```

If Sentry already owns that export, compose them with `composeRouterTransitionStart`. On the
component path there is nothing to re-export, and before Next 15.3 the file does not exist at
all — there the message is informational. The Pages Router adapter arms on its own and never
produces it.

One consequence worth knowing: if you filter with `pageviews.navigationTypes` and leave
`'unknown'` out of the list, unlabelled pageviews are dropped rather than sent.

## YM312

**Pageviews are held back, or a buffered call was dropped.**

Two limits share this code, and the message says which one you hit:

- `maxPerMinute` (60 by default) was exceeded, so further pageviews are held back for the rest of
  the window. A page that reports more than one pageview per second is usually a loop, not
  traffic.
- The call buffer overflowed. Calls made before the tag is ready wait in a FIFO of 100; the
  oldest is dropped to make room. In practice this means the tag never became ready — look for
  [YM201](#ym201).

## YM401

**Query parameters were removed from the reported URL.**

The default strip list is narrow on purpose — `access_token`, `id_token`, `refresh_token`,
anything ending in `_token`, `password`, `otp`, anything starting with `session`, `api_key`,
`client_secret`, `signature` — because a wide one silently eats ordinary product parameters like
`code`, `state` and `key`. Those four are only removed when you opt in with
`stripParams: 'oauth'`. The message lists what was removed.

Removing a parameter changes what your reports show, which is why this is announced at all. Set
`stripParams` to your own list if the default takes something you need.

This covers the pageviews **the package sends**. The tag's own initialisation request carries
`location.href` as the browser has it, so a secret in the address bar still reaches Metrica —
see `consent-and-pii.md`.

## YM402

**The reported URL exceeded 2048 characters and was truncated.**

Metrica stores a bounded URL, so the package cuts it rather than letting the collector decide.
Reports will show the cut form. If long URLs are normal in your app, shorten what you report with
`transformUrl` instead of letting the truncation land in the middle of a parameter.

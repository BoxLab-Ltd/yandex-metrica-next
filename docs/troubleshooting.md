# Why you do not see the data you expect

Because `defer: true` is forced, a broken installation is silent: the tag never sends a pageview
on its own, so you get **nothing** rather than something wrong. The upside is that every symptom
below has a specific cause.

## Start here

```ts
import { getStatus } from '@boxlab/yandex-metrica-next'

console.log(getStatus())
// { state: 'ready', counterId: 12345678, reason: undefined, pageviewsSent: 3, bufferedCalls: 0 }
```

`getStatus()` works everywhere, including on the server and with the tag blocked — it is the
diagnostic channel that survives into production, where the console messages do not. What the
states mean:

| `state`           | What it says                                                               |
| ----------------- | -------------------------------------------------------------------------- |
| `disabled`        | `register()` was never called, or it refused: no counter id, `mode: 'off'` |
| `idle`            | registered; the consent gate has not let the tag start yet                 |
| `consent-pending` | `consent: 'denied'` — the tag is not loaded and nothing is sent            |
| `loading`         | the script is in the document, the tag has not announced itself yet        |
| `ready`           | the tag is up; `pageviewsSent` should be growing as you navigate           |
| `blocked`         | it never became ready; `reason` is `timeout` — see below                   |
| `destroyed`       | `destruct()` or `revokeConsent()` ran                                      |

In development the console carries the rest: every diagnostic code is explained in
[diagnostics.md](./diagnostics.md).

## Nothing arrives at all

**The counter id never reached the package.** `register()` refuses anything that is not a positive
integer and says so with YM101 or YM102. If you rely on `NEXT_PUBLIC_YANDEX_METRICA_ID`, remember
it is inlined at build time: setting it in the deploy environment without rebuilding leaves the
bundle with nothing.

**You are in development.** With `mode: 'auto'` — the default — the package sends nothing outside
production and prints what it would have sent instead. That is deliberate: there is nothing safe
to send to from `localhost`. Point `devCounterId` at a separate counter if you want live data
while developing, or set `mode: 'on'` explicitly.

**The tag is blocked.** `state: 'blocked'` with `reason: 'timeout'` and YM201 mean the script never
announced itself. An ad blocker, a CSP rule and a dead network are indistinguishable from inside
the page, which is why there is one reason rather than three: check the network tab for
`mc.yandex.ru/metrika/tag.js`, look for a YM202 next to it, then read [csp.md](./csp.md).

**Consent is still pending.** `consent: 'denied'` keeps the tag out of the document entirely.
Calls made meanwhile are dropped rather than queued — see
[consent-and-pii.md](./consent-and-pii.md).

## Hits leave, reports stay empty

**Aggregation takes time.** Metrica's reports are not real time; give a fresh counter 15–30
minutes before concluding anything.

**The counter is filtering you out.** A counter created with "do not count my visits" enabled
drops everything from your own browser, which is exactly the browser you are testing with. Robot
filtering can hide the rest. Check the counter's settings before the code.

**You are looking at the wrong counter.** `getStatus().counterId` says which one the package is
actually using — `devCounterId` replaces `counterId` outside production, and that is easy to
forget.

## Navigations are missing

**Only the first pageview arrives.** The tracker listens to history writes, so a router that never
writes history produces no pageviews: check that navigation really changes the URL rather than only
the rendered content.

**Everything stopped after a remount.** A layout that unmounts the component and mounts it again
used to leave the package waiting for a readiness event the tag sends once per document. That is
fixed, but if you see `state: 'loading'` with `bufferedCalls` growing, you are looking at the same
shape of problem — open an issue with the version you are on.

**`navigationType` is `'unknown'` and YM304 is in the console.** The router hook is not wired.
Pageviews are unaffected — unless you filter with `navigationTypes` and leave `'unknown'` out of
the list, in which case they are dropped. See [YM304](./diagnostics.md#ym304).

**Query-only changes are not counted.** By design: `trigger` is `'pathname'`, so `?page=2` is the
same page. Set `trigger: 'url'` to count them; `searchDebounce` (500 ms) keeps a search box from
producing a pageview per keystroke.

**A hash change is not counted.** Also by design — `trackHashChanges: false`. An anchor is not a
page.

## The numbers are wrong

**Everything is counted twice.** Two installations: the component in the layout _and_
`register()` in `instrumentation-client.ts`, or the package alongside the official snippet. The
first case reports YM301 and disables the second tracker, so it does not actually double-count.
The second one is yours to find: a foreign `window.ym` is only reported in log mode (YM104), and a
second tag on the page is outside this package's reach.

**A redirect is counted twice.** It should not be: a `redirect()` in a Server Component and an
interrupted navigation both collapse into a single pageview through `commitDebounce` (100 ms). If
you see both URLs, your redirect is slower than that — raise `commitDebounce`.

**URLs are missing a prefix.** Under `basePath`, the package takes the prefix from Next's own
`__NEXT_ROUTER_BASEPATH`, so reported URLs match what the visitor sees. If they do not, you are
probably reporting URLs yourself through `hit()` — that path is not normalised for you.

**URLs are missing parameters, or cut short.** The strip list removed something
([YM401](./diagnostics.md#ym401)) or the URL was longer than 2048 characters
([YM402](./diagnostics.md#ym402)). Both are announced once in development.

**Titles belong to the previous page.** They should not: the package waits for React to replace
the `<title>` node, with a 400 ms ceiling. One exception is by design — an intercepted route
(a modal over a feed) keeps the underlying page's title, because Next does not apply a slot's
metadata on a soft navigation.

## In production everything is silent

That is the contract: the whole diagnostic table is dropped from production bundles, verified
against real Next builds in the e2e matrix, and `onDiagnostic` goes with it. What stays:

```ts
import { getStatus } from '@boxlab/yandex-metrica-next'

const { state, reason } = getStatus()
if (state === 'blocked') reportToYourLogger({ state, reason })
```

`getStatus()` works in production unchanged. To see a production problem with the full
diagnostics, reproduce it under `next dev` with `mode: 'on'`: the messages are back, and the
package sends for real — to `devCounterId` when one is set. For the vendor's own view,
`debug: true` sets `_ym_debug` before the tag loads and turns on its console output.

## Reporting a bug

The package is a thin layer over someone else's tag, so the useful report says which side is
involved. Include:

- versions: package, `next`, `react`, and the bundler (Turbopack or webpack);
- the router (App or Pages) and the install path (`instrumentation-client.ts` or the component);
- the output of `getStatus()` at the moment of the problem;
- any `YM…` codes from the console in a development build;
- for a counting problem: the URLs you expected and the ones the reports show.

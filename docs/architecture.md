# Architecture

How the package is put together, and why each piece is where it is. Read this before changing
the core; read [pageviews.md](./pageviews.md) for the tracker's behavioural contract.

## Layers

```
src/
├─ core/       framework-free: no React, no Next, runs in node, edge and the browser
├─ client/     `register()` and `onRouterTransitionStart` for instrumentation-client.ts
├─ react/      <YandexMetrica />, useMetrica(), useMetricaStatus()
├─ pages/      <YandexMetricaPages /> — the component plus a router.events adapter
├─ testing/    installYmMock(), resetMetricaRegistry()
└─ index.ts    the free functions, CSP helpers and every public type
```

Each directory is one subpath export. The root entry imports nothing from React or Next, so a
Server Component, a route handler or `proxy.ts` can import `metricaCsp` or a type without
pulling a client module into the server graph. The three client entries carry `'use client'` on
line 1 of both the ESM and the CJS build.

## What `register()` assembles

Both installation paths end in the same call. `<YandexMetrica />` calls it from an effect;
`instrumentation-client.ts` calls it at module level, before hydration.

```
register(config)
  ├─ resolveMode            auto | on | log | off, and which counter id applies
  ├─ getRegistry            the global state shared by every copy of the package
  ├─ createCallPipeline     the single outbound path; buffers until the tag is ready
  ├─ initCounter            stub → <script> → init, behind the consent gate
  ├─ createHistorySignals   patched pushState / replaceState + popstate = COMMIT
  ├─ createTitleSettler     waits for React to replace <title>
  └─ createPageviewTracker  COMMIT + optional ARM → one pageview
```

`register()` returns a handle whose `dispose()` undoes all of it: listeners, the history patch,
the title observer. It never calls `destruct`, because Metrica does not guarantee that the same
counter can be initialised twice on one page.

## The global registry

All state lives on `globalThis` under `Symbol.for('@boxlab/yandex-metrica-next.registry.v1')`,
never in a module variable. A Next app routinely loads the package more than once: the ESM and
CJS builds are separate module instances, and a package manager can install two versions side by
side. With module state, each instance would think it owned the counter, and the visible
symptom would be double hits with nothing in the console to explain them.

The registry holds the active runtime, the tag's readiness per counter, the owner of the single
pageview tracker, and the set of diagnostics already printed. The key is frozen forever: a new
key would mean two registries, which is exactly the failure it exists to prevent. Compatibility
between versions goes through its `schema` field instead. Every module instance counts itself
once, which is how [YM103](./diagnostics.md#ym103) knows a second copy is loaded.

The free functions — `reachGoal`, `hit`, `params` and the rest — read the runtime from the
registry on every call. That is what lets a goal fired from a CJS dependency reach a counter that
an ESM entry registered.

## One outbound path

Every call to the tag goes through `createCallPipeline`: pageviews, goals, `params`, `extLink`,
everything. That is not tidiness. `beforeSend` is a privacy hook, and a hook that applies to some
events and not to others is worse than none, because it is trusted. With one path, there is
nowhere for an event to slip past it.

The pipeline buffers while the tag is not ready, up to 100 calls; past that the oldest is
dropped and [YM312](./diagnostics.md#ym312) says so. An unbounded buffer on a page where the tag
never loads — an ad blocker, a CSP rule — would grow for the whole session.

## Loading the tag

`initCounter` installs the vendor stub (`ym.a`, `ym.l`), inserts `tag.js` with
`document.createElement`, and calls `init` with two parameters the package owns:

- **`defer: true`.** The tag never sends a pageview on its own, so the tracker is the only thing
  that does. Without it the first page would be counted twice: once by the tag on `init`, once
  by the router.
- **`triggerEvent: true`.** The tag dispatches `yacounter{id}inited` when it is ready — the only
  documented readiness signal. The pipeline flushes on it.

The tag is inserted by package code instead of `next/script`. That keeps the order stub → element →
nonce → append → init under the package's control, avoids `next/script`'s id-keyed load cache,
and keeps the snippet out of the HTML, so the default setup needs no nonce at all.

`tag.js` announces a counter exactly once per document. A remount — React StrictMode, a layout
that re-renders, a component removed and added back — would otherwise wait forever for an event
that has already fired. The registry remembers that the tag is ready, and a later registration
of the same counter becomes ready immediately.

With `consent: 'denied'` none of this happens: no script, no `init`, no stub calls. Until
`grantConsent()`, the pipeline drops instead of buffering, so nothing from before the visitor
agreed is replayed afterwards. See [consent-and-pii.md](./consent-and-pii.md).

## Pageviews: COMMIT and ARM

A pageview is sent on a **COMMIT** — a history write that changes the URL — and never on the
router's announcement of a navigation. The live probe behind [pageviews.md](./pageviews.md)
showed every App Router navigation, push, replace and traverse alike, writing history a few
milliseconds after `onRouterTransitionStart`. A history write is the moment the URL is final:
after redirects, after cancellations, after the page has rendered.

`onRouterTransitionStart` is an **ARM**. It sends nothing; it labels the next commit to the same
URL with a navigation type and a transition id. If the hook is missing, pageviews still go out,
only with `navigationType: 'unknown'`. That is why the component path, which cannot receive the
hook, counts pageviews identically to the instrumentation-client path.

Between a commit and a hit there are three more steps:

1. **Normalise** the URL: `basePath`, trailing slash, secret parameters stripped, the
   2048-character cap.
2. **Debounce** for 100 ms. A `redirect()` from a Server Component and a double click both commit
   twice within a few milliseconds; only the last one is a real page.
3. **Settle the title.** React 19 replaces the `<title>` node on every navigation, so an observer
   on the node goes deaf after the first one. The settler watches `document.head` for an added
   `<title>`, up to 400 ms.

Under the Pages Router `onRouterTransitionStart` is never called. `<YandexMetricaPages />` arms
from `routeChangeComplete` instead. It deliberately does not send: Next writes history before it
emits that event, so the pageview is already on its way through the ordinary commit path, and a
second sending path would be a second place for `beforeSend` to disagree with the first.

Only one tracker can run per document. A second `register()` while one is active starts nothing
and reports [YM301](./diagnostics.md#ym301).

## Modes and the production strip

`resolveMode` decides once, at registration:

| `mode`           | Production | Development                                              |
| ---------------- | ---------- | -------------------------------------------------------- |
| `auto` (default) | sends      | sends to `devCounterId` if set, otherwise logs each call |
| `on`             | sends      | sends, to `devCounterId` if set                          |
| `log`            | logs       | logs; never touches a foreign `window.ym`                |
| `off`            | nothing    | nothing                                                  |

Log mode loads no tag and installs no stub, so a dev server pointed at a production counter never
pollutes its reports.

Every diagnostic message sits behind a literal `process.env.NODE_ENV !== 'production'`
comparison. It has to be literal: bundlers substitute exactly that text, and the same check moved
into a helper — or written as `process?.env.NODE_ENV` — leaves the whole message table in every
production bundle. `scripts/assert-prod-strip.mjs` checks the shape on every build, and the e2e
matrix fetches the production chunks of real Next builds and asserts that none of the text ships.

## Build output

`tsdown` builds every entry twice, ESM and CJS, unbundled, so the file structure survives and
`'use client'` stays on line 1. Dual output is not a hedge: Jest under `next/jest` cannot load an
ESM-only package from `node_modules` without a `transformIgnorePatterns` change in every
consumer's config. `sideEffects` lists only `dist/client/**`: `instrumentation-client.ts` is
imported for its effect, and a bundler that believed it pure could drop it. Everything else
tree-shakes — a bare `reachGoal` import weighs about 200 bytes.

The published contract is checked from the tarball, never from the source tree: `publint
--strict`, `attw`, a type fixture compiled under React 18 and 19 types, a Node 20.9 smoke test,
and an e2e matrix that installs the tarball into real Next apps. [testing.md](./testing.md)
describes each of them.

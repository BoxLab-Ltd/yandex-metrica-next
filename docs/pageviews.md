# Pageview specification

> The tracker's behavioural contract. It freezes in v1.0.
> Section 1 records what was measured on a live stand on 2026-08-21: Next 16.3.3, React 19.2.8,
> Turbopack, production build, Chromium 151 driven by Playwright.
> Every row of the table in section 3 is covered by the e2e matrix, on both routers.

---

## 1. What the probe showed

The stand patched `history.pushState`/`replaceState`, listened for `popstate` and `pageshow`,
watched `<title>` with two MutationObservers — one on the node, one on `document.head` — and
logged `onRouterTransitionStart`. Twelve scenarios were run against a production build.

### 1.1 The order of signals is the same for every navigation

```
ARM  onRouterTransitionStart  url=/b type=push   loc=/a     ← intent
     history.pushState        url=/b loc=/a                 ← +3…7 ms, location is still the OLD one
     title.NODE_REPLACED      now="page-b"                  ← +0…1 ms
```

`replace` and `traverse` differ only by the method (`replaceState`) and by a `popstate` before
the ARM:

```
popstate                      loc=/a
ARM  onRouterTransitionStart  url=http://localhost:4055/a type=traverse
     history.replaceState     url=/a loc=/a
```

For `traverse` the hook reports an **absolute** URL, for `push` and `replace` a **root-relative**
one. The normaliser has to accept both.

### 1.2 History writes with no ARM — four different cases

| Case                               | Observation                                                             | How it is told apart   |
| ---------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| Router initialisation              | `replaceState url=/a loc=/a` about 15 ms after the module runs          | the URL did not change |
| `router.refresh()`                 | `replaceState url=/a loc=/a`                                            | the URL did not change |
| A repeat `push` to the current URL | `replaceState url=/b loc=/b`                                            | the URL did not change |
| Userland `history.pushState('/x')` | `pushState url=/x loc=/a`, then Next's own `replaceState url=/x loc=/x` | URL changed, no ARM    |

**Rule:** one condition — "the normalised URL changed" — removes the first three. No dedicated
detector for `refresh()` is needed.

### 1.3 A forgotten re-export is not zero hits

A run with an `instrumentation-client.ts` that does **not** re-export the hook:

```
LOAD:      instrumentation-client executed  ← the module runs
PUSH /b:   history.pushState url=/b loc=/a  ← the navigation is visible
           (no ARM)
```

The module runs, the tag comes up, the first pageview is sent and navigations are still observed
through history. Only `navigationType` is lost.

**Hence the shape of the tracker:**

- **COMMIT** = a history write whose normalised URL changed. Self-sufficient.
- **ARM** (`onRouterTransitionStart`) = **optional enrichment**: it supplies `navigationType` and
  `transitionId`.

The tracker works without the hook and degrades to `navigationType: 'unknown'`. YM304 stays a
useful warning at warn level rather than an error.

### 1.4 Cancellation: a redirect and a double click both need a debounce

`redirect()` from a Server Component (`/redir` → `/b`) produces **two full ARM+COMMIT pairs**:

```
ARM url=/redir type=push;  pushState url=/redir;     title.NODE_REPLACED now="root"
ARM url=/b type=replace;   replaceState url=/b;      title.NODE_REPLACED now="page-b"   ← +1 ms
```

The `/redir` pageview physically happened in history — neither signal rejects it on its own. A
double click (`push('/b')`, then `push('/a')` 20 ms later) produces the same picture with a 14 ms
gap.

**Rule:** sending a COMMIT is deferred by `commitDebounce` (**100 ms**), and a newer COMMIT
cancels the pending one. The real gaps — 1 ms and 14 ms — are covered with room to spare. The
price: two deliberate clicks inside 100 ms collapse into one pageview, which is acceptable.

### 1.5 React 19 replaces the whole `<title>` node

`title.NODE_REPLACED` fires on **every** navigation, including when the text does not change
(scenario 12: `document.title` was set to `page-b` in advance and the node was still replaced on
the way to `/b`).

Consequences:

- **Watch `document.head` with `childList: true`.** The naive
  `observe(titleEl, { childList: true, characterData: true })` misses the change: the old node
  leaves the DOM and an observer on it goes silent.
- The signal arrives **0–1 ms** after the history write, so the title is ready almost
  immediately. `titleTimeout: 400` is insurance, not the normal path.
- Resolving early is reliable even for two pages with the same title.

### 1.6 The hook's third argument

With `experimental.instrumentationClientRouterTransitionEvents: true` it arrives as
`{ id: 'mt974bqt-1', … }` — an identifier shaped like `${base36(Date.now())}-${counter}`, unique
within one page load. Without the flag it is strictly `null` and the branch is dropped by DCE.
The package does not turn anyone else's experimental flag on; `transitionId` is used only when it
is there.

---

## 2. The tracker's algorithm

```
COMMIT signal: patched history.pushState / history.replaceState + popstate

on historyWrite(url):
  next = normalize(url)                  # basePath, strip, trailingSlash, absolute
  if next === lastCommittedUrl: return   # router init, refresh(), repeat push
  if pendingTimer: clearTimeout(pendingTimer)   # cancellation: redirect, double click
  pending = { url: next, arm: armWithin(next, commitTimeout) }
  pendingTimer = setTimeout(flush, commitDebounce /* 100 */)

flush():
  lastCommittedUrl = pending.url
  if !shouldTrack(ctx): return
  if quotaExceeded(): warn(YM312); return
  title = await settleTitle(titleTimeout /* 400 */)   # MutationObserver on document.head
  event = beforeSend({ type: 'pageview', url: pending.url, title, ... })
  if event === null: return
  enqueue(() => ym(counterId, 'hit', event.url, { title: event.title, params: event.params }))

on onRouterTransitionStart(url, navigationType, event):
  armLog.push({ url: normalize(url), navigationType, id: event?.id ?? null, at: now() })
  # an ARM sends nothing — it only enriches the nearest COMMIT
```

The window is `commitTimeout` (10 s), not the 1 s of the first draft: a dynamic page commits only
once it has rendered, and the e2e matrix showed that a server response slower than a second turned
a correctly installed hook into a false YM304.

`armWithin(url, ms)` looks in `armLog` for an entry with the same normalised URL no older than
`ms`. When there is none, the pageview carries `navigationType: 'unknown'` and counts toward
YM304.

---

## 3. Behaviour table

| Event                              | Decision                                                                                                                             | Option (default)             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| First pageview after load          | always, from `register()`; `referer` = `document.referrer`                                                                           | `pageviews.first` (`true`)   |
| push / replace / traverse          | a pageview on COMMIT                                                                                                                 | `navigationTypes`            |
| Query-only change                  | not a pageview                                                                                                                       | `trigger` (`'pathname'`)     |
| Hash-only change                   | not a pageview                                                                                                                       | `trackHashChanges` (`false`) |
| `router.refresh()`                 | not a pageview — the URL did not change                                                                                              | —                            |
| Router initialisation              | not a pageview — the URL did not change                                                                                              | —                            |
| Userland `history.pushState`       | a pageview (the URL changed, no ARM)                                                                                                 | `trackHistoryApi` (`true`)   |
| `redirect()` in a Server Component | only the destination is reported                                                                                                     | `commitDebounce` (`100`)     |
| An interrupted navigation          | only the last URL is reported                                                                                                        | `commitDebounce`             |
| Intercepting / parallel route      | a pageview — the URL really changed; the `title` is the document's, since Next does not apply a slot's metadata on a soft navigation | `shouldTrack`                |
| bfcache (`pageshow.persisted`)     | nothing is sent                                                                                                                      | `bfcache` (`'ignore'`)       |
| The tag has not loaded yet         | the call waits in the buffer and is flushed when it is ready                                                                         | —                            |

Numeric defaults: `commitDebounce` 100, `dedupeWindow` 500, `commitTimeout` 10 000,
`titleTimeout` 400, `searchDebounce` 500, `initTimeout` 5 000, call buffer 100, `maxPerMinute` 60,
URL truncation at 2048.

---

## 4. What counts as a breaking change

A change in the observable **number or URL** of hits for unchanged user code is breaking in
substance, even when no signature moved: it breaks reports rather than compilation. The rule is
minor in 0.x, major from 1.0, and release notes that say what changes in your numbers.

---

## 5. Results of the other experiments (2026-08-21)

### E5 — mirrors: the tag does not pick a domain by geography. CLOSED

Taking the live `tag.js` (291 KB) apart:

- exactly two domains appear in the code: `mc.yandex.ru` and `mc.yandex.md`;
- the collection host is **hard-coded**: `host:"mc.yandex.ru"`;
- `geo`, `country` and `tld` do not occur at all; `region` occurs four times and only around
  **consent** (`"granted"===…`), that is regulatory regions rather than mirror selection;
- `mc.webvisor.com/.org` are absent from `tag.js` — they live in the separately loaded Session
  Replay module.

**Consequences for `metricaCsp()`:** the `regions: ['ru']` default is safe, because collection
goes to `mc.yandex.ru`. But **`mc.yandex.md` has to be in `connect-src` at all times**: the tag
calls `https://mc.yandex.md/cc`, the consent endpoint, and without it that mechanism breaks.
Session Replay hosts are added when `webvisor: true`, as planned.

### E6 — a cyclic type import under `isolatedDeclarations`: it works. CLOSED

A miniature package was built (tsdown, `unbundle: true`, declarations through oxc,
`isolatedDeclarations: true`) with a deliberate cycle between `index.ts` and `types/goals.ts`:

```ts
// dist/index.d.ts — the registry is declared HERE rather than re-exported
import { GoalArgs, GoalName } from './types/goals.js'
interface MetricaGoalRegistry {}
export { type GoalArgs, type GoalName, MetricaGoalRegistry, reachGoal }

// dist/types/goals.d.ts — the back reference of the cycle survives
import { MetricaGoalRegistry } from '../index.js'
```

A consumer with `declare module` and a `@ts-expect-error` on a typo passes `tsc --noEmit`
cleanly: the augmentation is visible **both from the root and from the `/react` subpath**, and the
typo is caught from the subpath. The scheme works, and the detector for the type fixture
reproduces.

### E3 — needs a real counter. DEFERRED to the staging counter

An isolated stand with the network replaced **does not reproduce the tag's working cycle**. The
cause is established: the real `mc.yandex.ru/watch/{id}` answers **302 with a set of cookies**
(`yandexuid`, `ymex`, `i`, `bh`), and cookies for `.yandex.ru` are not stored when the response
is fulfilled from a local origin. Without them the counter degrades: the first, automatic hit
goes out and **every later `ym(id,'hit',…)` quietly does not** — checked against three URL forms
(a foreign origin, an absolute local one, a relative one). Answering with a 302 that carries
cookies does not change it.

Whether `defer` and `sendTitle` apply to a `hit` that entered `ym.a` **before** `init` can only be
settled on a staging counter, where sending is legitimate. Until then the invariant "`defer: true`
is forced" stands as a design assumption.

### The side finding that changed the test strategy

The plan called for "three lines of defence against polluting a real counter: `page.route`
intercepts `mc.yandex.*` **by default**". The experiment showed that **with everything
intercepted the tag degrades after its first hit**. An e2e suite built on network assertions
would therefore verify the initial pageview and nothing else — not the navigation hits, which are
the whole point of the package.

What replaced it: two classes of e2e.

| Class                                | Network                             | What it proves                                                                        |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| **Offline** (every PR)               | every Metrica host intercepted      | that **the package called** `ym(...)` with the right arguments — a spy on `window.ym` |
| **Online** (nightly, before release) | the real network, a staging counter | that hits actually leave and arrive in the reports                                    |

The offline assertions moved from the network layer to `window.ym`: more reliable, and
independent of the tag's internal state. Interception stays as a guard against leaking, not as
the source of truth.

### What is left

| #   | Question                                             | Impact                                                     |
| --- | ---------------------------------------------------- | ---------------------------------------------------------- |
| E3  | `defer`/`sendTitle` for a `hit` queued before `init` | the forced-`defer` invariant; settled on a staging counter |

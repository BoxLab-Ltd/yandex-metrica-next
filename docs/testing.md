# Testing

Two audiences: you, testing an app that reports to Metrica, and contributors, testing the package
itself.

## Testing your app

`@boxlab/yandex-metrica-next/testing` replaces the tag with a recorder. Your code calls the package
exactly as in production; the test reads what reached `window.ym`.

```tsx
import { afterEach, beforeEach, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
    register,
    type MetricaHandle,
} from '@boxlab/yandex-metrica-next/client'
import { whenReady } from '@boxlab/yandex-metrica-next'
import {
    installYmMock,
    resetMetricaRegistry,
    type YmMock,
} from '@boxlab/yandex-metrica-next/testing'

let mock: YmMock
let handle: MetricaHandle

beforeEach(async () => {
    resetMetricaRegistry()
    mock = installYmMock()
    handle = register({ counterId: 12345678, mode: 'on', pageviews: false })
    await whenReady()
})

afterEach(() => {
    handle.dispose()
    mock.restore()
})

it('reports the sign-up goal', () => {
    render(<SignUpButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(mock.forMethod('reachGoal')).toEqual([
        {
            counterId: 12345678,
            method: 'reachGoal',
            args: ['sign_up', { plan: 'pro' }, undefined],
        },
    ])
})
```

Four lines in that setup are not optional:

- **`mode: 'on'`.** Test runners set `NODE_ENV=test`, and outside production the default `auto`
  mode logs calls instead of sending them. Without it the mock receives nothing.
- **`resetMetricaRegistry()`.** The package keeps its state on `globalThis` so that every copy of
  it shares one counter. In a test that state outlives the test unless you clear it.
- **`handle.dispose()`.** `register()` patches `history.pushState` and `replaceState`; dispose puts
  them back.
- **`await whenReady()`.** The package buffers every call until the tag announces itself, and the
  mock announces in a microtask after `init`, like the real tag. React Testing Library's `act()`
  usually flushes that for you; a plain function test that asserts right after `register()` would
  see an empty `calls`.

Components that call `useMetrica()` need no provider: the hook reads the same global runtime,
so registering once in `beforeEach` is enough. If your app mounts `<YandexMetrica />` instead,
render it with `mode="on"` and the same reset and restore around each test.

### Pageviews

Pageviews are debounced by 100 ms and wait up to 400 ms for React to replace `<title>`. Fake
timers make that deterministic:

```ts
vi.useFakeTimers()
mock = installYmMock()
history.replaceState({}, '', '/pricing')
handle = register({ counterId: 12345678, mode: 'on' })
await vi.advanceTimersByTimeAsync(500)

history.pushState({}, '', '/checkout')
await vi.advanceTimersByTimeAsync(500)

expect(mock.forMethod('hit').map(call => call.args[0])).toEqual([
    'http://localhost:3000/pricing',
    'http://localhost:3000/checkout',
])
```

URLs arrive absolute — the origin is whatever your jsdom environment is configured with.

### A tag that has not loaded yet

`installYmMock({ loaded: false })` holds calls in `mock.queued` instead of `mock.calls`, the way
the vendor stub does before `tag.js` arrives. `mock.load()` drains the queue and announces every
counter that was initialised meanwhile. Use it to test what your code does while the tag is
still loading — a login flow that awaits `getClientId()`, for instance, which resolves `null` on
timeout rather than rejecting.

### Asserting nothing was sent

```ts
handle = register({ counterId: 12345678, mode: 'on', consent: 'denied' })
reachGoal('sign_up')

expect(mock.calls).toEqual([])
```

With consent denied the package never calls `init` and never forwards anything, so an empty
`calls` is the whole assertion. After `grantConsent()` the current page is counted; the goal from
before it is not.

### Jest

The testing entry ships CommonJS too, so `next/jest` loads it with no `transformIgnorePatterns`
change. Use `testEnvironment: 'jsdom'`; the readiness announcement is a DOM event.

## Testing the package

| Level   | Tool                                    | What it proves                                                                  |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Unit    | Vitest, jsdom                           | URL normalisation, debounce, buffer, title settle, consent, diagnostics         |
| Types   | `vitest typecheck`, a tarball fixture   | goal registry augmentation reaches every subpath; React 18 and 19 types compile |
| Package | `publint`, `attw`, `size-limit`, guards | the published contract: exports, both formats, `'use client'`, the dev strip    |
| E2E     | Playwright, real Next builds            | how many pageviews left, with which URL, in which scenario                      |

```sh
bun install
bun run typecheck && bun run lint && bun run format:check
bun run build && bun run size && bun run test
bun run lint:pkg && bun run test:types
bun run e2e list && bun run e2e run next16-turbopack-client
```

`build` comes before `test`: one test starts Node against `dist` to prove that the ESM and CJS
builds share a runtime.

### The e2e matrix

Each cell copies an example app out of the repository, installs the packed tarball into it —
never a workspace link, which would hide packaging defects — and runs a production build and
`next start`. The source of truth is a spy on `window.ym`, not the network: with `mc.yandex.*`
intercepted, the real tag degrades after the first hit and stops sending, so network assertions
would silently stop reflecting what the package did. The interception stays, as a guard that no
request ever leaves for a real collector.

Cells cover Next 15 and 16, React 18 and 19, webpack and Turbopack, both routers, both
installation paths, Sentry owning `onRouterTransitionStart`, a CommonJS `next.config.js`, and a
`basePath`. `node scripts/e2e.mjs matrix` prints the list CI runs.

### Breaking the detector

After writing a non-trivial check, break the thing it checks and watch it turn red. Over four
stages this found eight checks that were green by accident — a type test tsc never saw, a
tarball fixture reading a cached tarball, a strip check with the wrong minifier as its oracle,
a test counting hits while a duplicate tracker silently buffered them. E2E mutations are made in
the cell's working copy under `$TMPDIR/ymn-e2e/<cell>` and rebuilt there; the repository is never
touched.

Two kinds of check need a real counter and stay manual: Metrica's reports aggregating the hits,
and Session Replay playing back a recording.

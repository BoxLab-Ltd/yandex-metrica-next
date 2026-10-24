# Content Security Policy

The default setup needs **no nonce at all**. The package never inserts an inline script: the tag
arrives as an external `src`, created by package code that already runs from your bundle. Under a
policy with `'strict-dynamic'` that is enough on its own — a script inserted by an allowed script
is allowed too.

What a policy does have to say is where the tag may _talk_, and that part is easy to get wrong in
a way nothing reports until data goes missing.

## The directives

`metricaCsp(options)` returns the directives as a record, `metricaCspString(options)` as a string.

```ts
import { metricaCsp } from '@boxlab/yandex-metrica-next'

metricaCsp({ webvisor: true })
// {
//   'script-src': ['https://mc.yandex.ru', 'https://yastatic.net'],
//   'connect-src': [
//     'https://mc.yandex.ru', 'https://mc.yandex.md',
//     'https://mc.webvisor.com', 'https://mc.webvisor.org',
//     'wss://mc.yandex.ru', 'wss://mc.yandex.md',
//     'wss://mc.webvisor.com', 'wss://mc.webvisor.org',
//   ],
//   'img-src': ['https://mc.yandex.ru', 'https://yastatic.net'],
//   'frame-src': ['blob:', 'https://mc.yandex.ru'],
//   'child-src': ['blob:', 'https://mc.yandex.ru'],
// }
```

| Option           | Default | Effect                                                                        |
| ---------------- | ------- | ----------------------------------------------------------------------------- |
| `regions`        | `'ru'`  | `'all'` adds the other 17 Yandex zones to `connect-src`                       |
| `webvisor`       | `false` | adds the Session Replay hosts and the `frame-src` / `child-src` pair          |
| `strictDynamic`  | `false` | drops `script-src` hosts: CSP3 ignores them next to `'strict-dynamic'` anyway |
| `frameAncestors` | `false` | opt-in; lets Metrica's interface embed your site — see the warning below      |

Two facts behind the defaults, both taken from the tag itself rather than from documentation:

- **Collection is hard-coded to `mc.yandex.ru`.** The tag contains exactly two domains and no
  geo-based mirror selection, so the `'ru'` default is not a regional guess.
- **`mc.yandex.md` is required even then.** The tag calls `https://mc.yandex.md/cc` — the consent
  endpoint — regardless of where the visitor is. Drop it as "another region" and you break that
  mechanism.

Hits travel by `fetch` and XHR, not as images, which is why the collection hosts live in
`connect-src`. `img-src` is there for the `<noscript>` pixel and the ad-block detection gif.

## Merging, not appending

A directive that appears twice in one header is ignored after its first occurrence. Appending
`metricaCspString()` to a policy that already declares `img-src` therefore silently drops the
Metrica sources. Merge the lists instead:

```ts
const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    'img-src': ["'self'", 'blob:', 'data:'],
    // Declaring connect-src at all drops the default-src fallback, so the router's own
    // requests need 'self' back.
    'connect-src': ["'self'"],
}

for (const [name, sources] of Object.entries(
    metricaCsp({ strictDynamic: true, webvisor: true }),
)) {
    directives[name] = [...(directives[name] ?? []), ...sources]
}

const policy = Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
```

That is the shape of `examples/app-router/proxy.ts`, and the whole e2e suite runs against it: the tag
loads, the pageviews are correct and the page reports zero violations. Removing the merge loop is
one of the mutations the suite is checked with — `connect-src` then blocks `/watch/` and `img-src`
blocks the gif, exactly as it would in production.

## Where the policy goes in Next

A nonce-based policy belongs in `proxy.ts` (Next 16) or `middleware.ts` (Next 15 and earlier),
because the nonce has to be generated per request:

```ts
export function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    // …build the policy…
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', policy)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', policy)
    return response
}

export const config = { matcher: '/checkout' } // only the routes that need a nonce
```

Two consequences of that choice:

- **A nonce forces dynamic rendering.** Next reads the policy from the request to nonce its own
  scripts, so a page under a nonce policy cannot be static. Limit the `matcher` to the routes that
  need it, and skip prefetches — the Next documentation has the matcher for that.
- **You do not have to nonce the tag.** Under `'strict-dynamic'` it is allowed as a descendant of
  an allowed script. Pass `nonce` to `register()` only for a CSP2 policy without
  `'strict-dynamic'`; `nonce={null}` and `nonce=""` are treated as absent rather than written out
  as the string `"null"`.

A policy without nonces — hosts only — works too and keeps pages static. That configuration is
covered by its own cell in the matrix, where the policy comes from `metricaCsp()` inside a
CommonJS `next.config.js` and applies to every route.

## frame-ancestors

`frameAncestors: true` emits the 23 hosts of the Metrica interface so that click maps and Session
Replay can open your site inside their UI. It is opt-in for a reason: it widens your clickjacking
surface to everything on that list. It also only works as a response header — `frame-ancestors` in
a `<meta>` tag is ignored by browsers.

## When something is blocked

The package listens for `securitypolicyviolation` and reports the violations that belong to
Metrica as [YM202](./diagnostics.md#ym202), naming the blocked URI and the directive that refused
it. Like every diagnostic it is development-only: a production build carries neither the message
nor the `onDiagnostic` call. To collect violations from production, use the policy's own
`report-to` endpoint — it sees every directive, not only Metrica's.

Roll a new policy out with `Content-Security-Policy-Report-Only` first. A report-only header
produces the same violation events without breaking the page, so YM202 tells you what is missing
while the tag still works.

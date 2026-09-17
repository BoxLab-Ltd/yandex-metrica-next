# Consent and personal data

This package gives you primitives: a gate that decides whether the tag loads at all, one place
where every outbound call can be edited or cancelled, and a URL sanitiser with a deliberately
narrow default. What your site is allowed to collect, from whom, and on what legal basis is your
decision and your responsibility — no library can make it for you, and this one does not claim to.

Read the section on [what the package does not cover](#what-the-package-does-not-cover) before
you rely on any of it: the tag sends requests of its own, and the sanitiser does not touch them.

## The consent gate

`consent: 'denied'` means the script is never inserted and `init` is never called. That is the
only implementation with no gap in it — a tag that is loaded but told to behave is still a tag
that ran.

```ts
register({
    counterId: 12345678,
    consent: hasConsent ? 'granted' : 'denied',
})
```

When the visitor agrees later, call `grantConsent()`: the tag is inserted at that moment and the
first pageview is sent then, not retroactively.

```ts
import { grantConsent } from '@boxlab/yandex-metrica-next'
```

`revokeConsent()` is one-way in practice. It sets `disableYaCounter{id}`, calls the tag's
`destruct` and drops the counter's state, but Metrica does not guarantee that the same counter can
be initialised again in the same session. Treat a revocation as final for that page load and
reload after it if you need a clean state.

Calls made while consent is pending are dropped rather than replayed on grant: replaying them
would send, after the fact, events the visitor had not agreed to. The page they agreed on is not
lost either — granting consent counts the current page at that moment, so a landing page still
appears in your reports.

## beforeSend

`beforeSend` sees **every** event the package sends — pageviews, goals, parameters, user
parameters, user ids, external links, file downloads — before it reaches the tag. Return `null`
to cancel, or return a modified event to change what is sent.

```ts
register({
    counterId: 12345678,
    beforeSend: event => {
        if (event.type === 'pageview' && event.url.includes('/admin'))
            return null
        return event
    },
})
```

One hook for all event types is a deliberate constraint: a privacy control with exceptions is
not a control. It cannot be passed from a Server Component, so it lives in
`instrumentation-client.ts` or wherever you call `register()` on the client — the component's
props reject functions by type.

## The URL sanitiser

Pageview URLs are normalised before they are sent, and a short list of parameters is removed:

`access_token`, `id_token`, `refresh_token`, anything ending in `_token`, `password`, `otp`,
anything starting with `session`, `api_key`, `client_secret`, `signature`.

The list is narrow on purpose. A wide deny-list eats `code`, `state`, `key` and `hash`, which are
ordinary product parameters — promo codes, filters, pagination — and the resulting hole in your
reports is invisible from inside Metrica. Those four are removed only when you ask:

```ts
register({ counterId: 12345678, pageviews: { stripParams: 'oauth' } })
```

`stripParams` also takes your own list, and `stripParams: false` turns removal off. Whenever
something is removed, the package prints [YM401](./diagnostics.md#ym401) once with the names, so
the loss is never silent. `transformUrl` rewrites a URL entirely when a path segment — an order
id, a token in the path — is the problem.

## What the package does not cover

**The tag's own requests carry the address bar as it is.** Once `tag.js` is running it sends its
initialisation request, its internal telemetry and, when enabled, Session Replay and click-map
traffic. Those requests take `location.href` from the browser. The sanitiser above applies to the
pageviews **this package** sends and to nothing else, so a secret in the URL still reaches Metrica
through the tag's own request:

```
GET https://mc.yandex.ru/watch/12345678?…&page-url=https%3A%2F%2Fshop.example%2Fcallback%3Faccess_token%3D…&nohit=1
```

There are exactly three ways to deal with it, and all of them are yours, not the package's:

1. **Do not put secrets in URLs.** Tokens belong in a POST body or a fragment you strip before
   the router settles.
2. **Clean the address before the tag loads.** Replace the URL first, then register:

    ```ts
    const url = new URL(window.location.href)
    if (url.searchParams.has('access_token')) {
        url.searchParams.delete('access_token')
        window.history.replaceState(null, '', url)
    }
    register({ counterId: 12345678 })
    ```

3. **Hold the tag behind the consent gate** until the page is on a URL you are willing to send —
   `consent: 'denied'` first, `grantConsent()` afterwards.

**Cookies and storage belong to the tag.** It sets first-party cookies such as `_ym_uid` and
`_ym_d`, and the collector sets its own on `.yandex.ru`. None of that is created, named or
controlled by this package; `consent: 'denied'` prevents all of it simply by never loading the
tag.

**Session Replay records the page.** With `webvisor: true` the tag captures the DOM and user
input. Masking is configured in the Metrica interface, on the vendor's side; if you record
forms, decide what the recording may contain before you turn it on.

**`firstPartyParams` is not in this version.** Sending hashed emails or phone numbers is the
transfer of personal data, hashing does not make it anonymous, and the feature needs
documentation of its own. It is planned for v1.1 rather than smuggled into v0.1.

**`yaDisableGDPR` is not exposed.** The tag has an option that suppresses the consent popup for
visitors from the EEA. It is not in the public types: typing it would amount to advertising it.

## What the package promises

- The tag is not inserted and `init` is not called while consent is denied.
- Every event the package sends passes through `beforeSend` first.
- The default strip list removes the parameters listed above from the pageviews it sends, and
  says so once through YM401.
- Nothing is sent from the server, and nothing is sent before the tag is ready — calls wait in a
  bounded buffer instead.

That is the whole list. Everything beyond it — what your policy says, what your banner asks, what
your legal basis is — is outside a library's reach.

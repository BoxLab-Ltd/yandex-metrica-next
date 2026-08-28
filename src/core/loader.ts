import type { CounterId } from '../index.js'

export const TAG_JS_URL = 'https://mc.yandex.ru/metrika/tag.js'
export const TAG_JS_URL_COM = 'https://mc.yandex.com/metrika/tag.js'
/** Unversioned latest: SRI is impossible, so the supply-chain risk is the caller's. */
export const TAG_JS_URL_JSDELIVR =
    'https://cdn.jsdelivr.net/npm/yandex-metrica-watch/tag.js'

export type MetricaDomain = 'ru' | 'com'

export interface LoadTagOptions {
    scriptSrc?: string
    domain?: MetricaDomain
    nonce?: string | null
    debug?: boolean
}

export interface TagLoadResult {
    element: HTMLScriptElement | null
    alreadyPresent: boolean
}

export const noscriptPixelUrl = (
    counterId: CounterId,
    options: { domain?: MetricaDomain } = {},
): string =>
    `https://mc.yandex.${options.domain === 'com' ? 'com' : 'ru'}/watch/${String(counterId)}`

export const resolveTagUrl = (options: LoadTagOptions = {}): string =>
    options.scriptSrc ??
    (options.domain === 'com' ? TAG_JS_URL_COM : TAG_JS_URL)

/**
 * The tag is injected with our own createElement rather than next/script: that keeps the
 * order "stub -> element -> nonce -> append -> init" under our control, avoids next/script's
 * id-keyed load cache, and keeps the snippet out of the HTML so no nonce is needed at all
 * under the default setup.
 */
export function loadTag(options: LoadTagOptions = {}): TagLoadResult {
    if (typeof document === 'undefined')
        return { element: null, alreadyPresent: false }

    const src = resolveTagUrl(options)
    for (const script of document.scripts) {
        if (script.src === src) return { element: script, alreadyPresent: true }
    }

    // Must be set before the tag evaluates, or the vendor debug panel never turns on.
    if (options.debug === true) {
        ;(globalThis as { _ym_debug?: boolean })._ym_debug = true
    }

    const element = document.createElement('script')
    element.async = true
    element.src = src
    // Falsy nonce must not become the string "null": setAttributesFromProps-style code
    // would happily write it and quietly break the policy.
    if (
        options.nonce !== undefined &&
        options.nonce !== null &&
        options.nonce !== ''
    ) {
        element.setAttribute('nonce', options.nonce)
    }
    document.head.append(element)

    return { element, alreadyPresent: false }
}

export type CspRegions = 'ru' | 'all'

export interface CspOptions {
    webvisor?: boolean
    regions?: CspRegions
    /**
     * Set when the policy uses 'strict-dynamic'. CSP3 then ignores host sources in
     * script-src entirely, so they are emitted only as a CSP2 fallback.
     */
    strictDynamic?: boolean
    /** Opt-in: lets Yandex frame your site so click maps and Session Replay open in their UI. */
    frameAncestors?: boolean
}

const YANDEX_ZONES = [
    'ru',
    'az',
    'by',
    'co.il',
    'com',
    'com.am',
    'com.ge',
    'com.tr',
    'ee',
    'fr',
    'kg',
    'kz',
    'lt',
    'lv',
    'md',
    'tj',
    'tm',
    'uz',
] as const

const WEBVISOR_HOSTS = ['mc.webvisor.com', 'mc.webvisor.org'] as const

/**
 * Collection is hard-coded to mc.yandex.ru inside tag.js — there is no geo-based mirror
 * selection — so the ru default is safe. But mc.yandex.md is not optional: the tag calls
 * https://mc.yandex.md/cc for consent, and dropping it as "another region" breaks that.
 */
const REQUIRED_COLLECTION_HOSTS = ['mc.yandex.ru', 'mc.yandex.md'] as const

const METRICA_UI_HOSTS = [
    'metrika.yandex.ru',
    'metrika.yandex.by',
    'metrika.yandex.com',
    'metrika.yandex.com.tr',
    'metrika.yandex.kz',
    'metrika.yandex.uz',
    'metrika.ya.ru',
    'metrica.yandex.ru',
    'metrica.yandex.by',
    'metrica.yandex.com',
    'metrica.yandex.com.tr',
    'metrica.yandex.kz',
    'metrica.ya.ru',
    'analytics.yandex.ru',
    'analytics.yandex.by',
    'analytics.yandex.com',
    'analytics.yandex.com.tr',
    'analytics.yandex.kz',
    'metr.yandex.ru',
    'metr.yandex.by',
    'metr.yandex.com',
    'metr.yandex.com.tr',
    'metr.yandex.kz',
] as const

const collectionHosts = (regions: CspRegions): string[] =>
    regions === 'all'
        ? YANDEX_ZONES.map(zone => `mc.yandex.${zone}`)
        : [...REQUIRED_COLLECTION_HOSTS]

/** Directives Metrica needs. Merge into your own policy; this is not a whole policy. */
export function metricaCsp(options: CspOptions = {}): Record<string, string[]> {
    const regions = options.regions ?? 'ru'
    const webvisor = options.webvisor ?? false

    const hosts = collectionHosts(regions)
    const connectHosts = webvisor ? [...hosts, ...WEBVISOR_HOSTS] : hosts

    const directives: Record<string, string[]> = {
        // Under 'strict-dynamic' these are dead weight for CSP3 browsers and a fallback
        // for CSP2 ones; the package's own code runs from a nonced bundle either way.
        'script-src':
            options.strictDynamic === true
                ? []
                : ['https://mc.yandex.ru', 'https://yastatic.net'],
        // Hits travel by fetch and sendBeacon, not by image, so they live here, not in img-src.
        'connect-src': [
            ...connectHosts.map(host => `https://${host}`),
            ...connectHosts.map(host => `wss://${host}`),
        ],
        // img-src covers the <noscript> pixel and the adblock-detection gif.
        'img-src': ['https://mc.yandex.ru', 'https://yastatic.net'],
    }

    if (webvisor) {
        directives['frame-src'] = ['blob:', 'https://mc.yandex.ru']
        // Legacy alias Yandex still asks for; worker-src also falls back to it.
        directives['child-src'] = ['blob:', 'https://mc.yandex.ru']
    }

    if (options.frameAncestors === true) {
        directives['frame-ancestors'] = METRICA_UI_HOSTS.map(
            host => `https://${host}`,
        )
    }

    for (const key of Object.keys(directives)) {
        if (directives[key]?.length === 0) delete directives[key]
    }

    return directives
}

export function metricaCspString(options: CspOptions = {}): string {
    return Object.entries(metricaCsp(options))
        .map(([directive, values]) => `${directive} ${values.join(' ')}`)
        .join('; ')
}

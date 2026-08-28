import { describe, expect, it } from 'vitest'
import { metricaCsp, metricaCspString } from './csp.js'

describe('metricaCsp — collection hosts', () => {
    it('always includes mc.yandex.md, even in the ru default', () => {
        // The tag calls https://mc.yandex.md/cc for consent; dropping it as "another
        // region" breaks the consent mechanism silently.
        expect(metricaCsp()['connect-src']).toContain('https://mc.yandex.md')
    })

    it('keeps the ru default small', () => {
        expect(metricaCsp()['connect-src']).toEqual([
            'https://mc.yandex.ru',
            'https://mc.yandex.md',
            'wss://mc.yandex.ru',
            'wss://mc.yandex.md',
        ])
    })

    it('expands to every zone on request', () => {
        const connect = metricaCsp({ regions: 'all' })['connect-src'] ?? []
        expect(connect).toContain('https://mc.yandex.com.tr')
        expect(connect).toContain('wss://mc.yandex.kz')
        expect(connect).toHaveLength(36)
    })

    it('pairs every https host with a wss host', () => {
        const connect = metricaCsp({ regions: 'all' })['connect-src'] ?? []
        const https = connect.filter(h => h.startsWith('https://')).length
        const wss = connect.filter(h => h.startsWith('wss://')).length
        expect(https).toBe(wss)
    })
})

describe('metricaCsp — webvisor', () => {
    it('adds webvisor hosts and frame directives', () => {
        const csp = metricaCsp({ webvisor: true })
        expect(csp['connect-src']).toContain('https://mc.webvisor.com')
        expect(csp['connect-src']).toContain('wss://mc.webvisor.org')
        expect(csp['frame-src']).toEqual(['blob:', 'https://mc.yandex.ru'])
        expect(csp['child-src']).toEqual(['blob:', 'https://mc.yandex.ru'])
    })

    it('omits frame directives when webvisor is off', () => {
        const csp = metricaCsp()
        expect(csp['frame-src']).toBeUndefined()
        expect(csp['child-src']).toBeUndefined()
    })
})

describe('metricaCsp — strict-dynamic', () => {
    it('drops script-src hosts, which CSP3 ignores anyway', () => {
        expect(
            metricaCsp({ strictDynamic: true })['script-src'],
        ).toBeUndefined()
    })

    it('keeps them as a CSP2 fallback otherwise', () => {
        expect(metricaCsp()['script-src']).toEqual([
            'https://mc.yandex.ru',
            'https://yastatic.net',
        ])
    })

    it('never touches the other directives', () => {
        expect(metricaCsp({ strictDynamic: true })['connect-src']).toBeDefined()
        expect(metricaCsp({ strictDynamic: true })['img-src']).toBeDefined()
    })
})

describe('metricaCsp — frame-ancestors', () => {
    it('is absent by default, because it widens clickjacking exposure', () => {
        expect(
            metricaCsp({ webvisor: true })['frame-ancestors'],
        ).toBeUndefined()
    })

    it('lists the Metrica UI hosts when opted in', () => {
        const ancestors =
            metricaCsp({ frameAncestors: true })['frame-ancestors'] ?? []
        expect(ancestors).toContain('https://metrika.yandex.ru')
        expect(ancestors.length).toBeGreaterThan(20)
    })
})

describe('metricaCspString', () => {
    it('renders directives as a header value', () => {
        const value = metricaCspString()
        expect(value).toMatch(
            /^script-src https:\/\/mc\.yandex\.ru https:\/\/yastatic\.net; /,
        )
        expect(value).toContain(
            'connect-src https://mc.yandex.ru https://mc.yandex.md',
        )
    })

    it('matches a snapshot for the ru default', () => {
        expect(metricaCspString()).toMatchInlineSnapshot(
            `"script-src https://mc.yandex.ru https://yastatic.net; connect-src https://mc.yandex.ru https://mc.yandex.md wss://mc.yandex.ru wss://mc.yandex.md; img-src https://mc.yandex.ru https://yastatic.net"`,
        )
    })

    it('matches a snapshot for webvisor with strict-dynamic', () => {
        expect(
            metricaCspString({ webvisor: true, strictDynamic: true }),
        ).toMatchInlineSnapshot(
            `"connect-src https://mc.yandex.ru https://mc.yandex.md https://mc.webvisor.com https://mc.webvisor.org wss://mc.yandex.ru wss://mc.yandex.md wss://mc.webvisor.com wss://mc.webvisor.org; img-src https://mc.yandex.ru https://yastatic.net; frame-src blob: https://mc.yandex.ru; child-src blob: https://mc.yandex.ru"`,
        )
    })
})

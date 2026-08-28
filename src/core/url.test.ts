import { describe, expect, it } from 'vitest'
import { MAX_URL_LENGTH, normalizeUrl } from './url.js'

const O = 'https://shop.example'
const at = (input: string, options = {}) =>
    normalizeUrl(input, { origin: O, ...options }).url

describe('normalizeUrl — input forms', () => {
    it('accepts a root-relative path', () => {
        expect(at('/about')).toBe(`${O}/about`)
    })

    it('accepts an absolute URL on the same origin', () => {
        expect(at(`${O}/about`)).toBe(`${O}/about`)
    })

    it('accepts a path with query', () => {
        expect(at('/search?q=hat')).toBe(`${O}/search?q=hat`)
    })

    it('returns null for another origin', () => {
        expect(at('https://evil.example/about')).toBeNull()
    })

    it('returns null for a malformed input', () => {
        expect(normalizeUrl('http://', { origin: O }).url).toBeNull()
    })

    it('keeps the root path', () => {
        expect(at('/')).toBe(`${O}/`)
    })
})

describe('normalizeUrl — basePath', () => {
    it('adds basePath when the input lacks it', () => {
        expect(at('/pricing', { basePath: '/shop' })).toBe(`${O}/shop/pricing`)
    })

    it('does not double an existing basePath', () => {
        expect(at('/shop/pricing', { basePath: '/shop' })).toBe(
            `${O}/shop/pricing`,
        )
    })

    it('handles the root path under basePath', () => {
        expect(at('/', { basePath: '/shop' })).toBe(`${O}/shop`)
    })

    it('tolerates a trailing slash in basePath', () => {
        expect(at('/pricing', { basePath: '/shop/' })).toBe(`${O}/shop/pricing`)
    })

    it('does not treat a prefix match as basePath', () => {
        expect(at('/shopping', { basePath: '/shop' })).toBe(
            `${O}/shop/shopping`,
        )
    })

    it('is a no-op with an empty basePath', () => {
        expect(at('/pricing', { basePath: '' })).toBe(`${O}/pricing`)
    })
})

describe('normalizeUrl — trailing slash', () => {
    it('preserves by default', () => {
        expect(at('/a/')).toBe(`${O}/a/`)
        expect(at('/a')).toBe(`${O}/a`)
    })

    it('always adds one', () => {
        expect(at('/a', { trailingSlash: 'always' })).toBe(`${O}/a/`)
        expect(at('/a/', { trailingSlash: 'always' })).toBe(`${O}/a/`)
    })

    it('never keeps one', () => {
        expect(at('/a/', { trailingSlash: 'never' })).toBe(`${O}/a`)
        expect(at('/a', { trailingSlash: 'never' })).toBe(`${O}/a`)
    })

    it('leaves the root path alone in every mode', () => {
        expect(at('/', { trailingSlash: 'never' })).toBe(`${O}/`)
        expect(at('/', { trailingSlash: 'always' })).toBe(`${O}/`)
    })
})

describe('normalizeUrl — i18n and nested paths', () => {
    it('keeps a locale segment', () => {
        expect(at('/en/pricing')).toBe(`${O}/en/pricing`)
    })

    it('combines a locale segment with basePath', () => {
        expect(at('/en/pricing', { basePath: '/shop' })).toBe(
            `${O}/shop/en/pricing`,
        )
    })
})

describe('normalizeUrl — hash', () => {
    it('drops the hash by default', () => {
        expect(at('/a#section')).toBe(`${O}/a`)
    })

    it('keeps the hash when asked', () => {
        expect(at('/a#section', { includeHash: true })).toBe(`${O}/a#section`)
    })
})

describe('normalizeUrl — query and secrets', () => {
    it('keeps ordinary parameters', () => {
        expect(at('/s?q=hat&page=2')).toBe(`${O}/s?q=hat&page=2`)
    })

    it('drops the whole query when includeSearch is false', () => {
        expect(at('/s?q=hat', { includeSearch: false })).toBe(`${O}/s`)
    })

    it.each([
        'access_token',
        'id_token',
        'refresh_token',
        'password',
        'otp',
        'api_key',
        'client_secret',
        'signature',
    ])('strips %s', name => {
        const result = normalizeUrl(`/cb?${name}=secret&keep=1`, { origin: O })
        expect(result.url).toBe(`${O}/cb?keep=1`)
        expect(result.strippedParams).toEqual([name])
    })

    it('strips any *_token parameter', () => {
        expect(at('/cb?csrf_token=x&keep=1')).toBe(`${O}/cb?keep=1`)
    })

    it('strips session-prefixed parameters', () => {
        expect(at('/cb?sessionId=x&keep=1')).toBe(`${O}/cb?keep=1`)
    })

    it('is case-insensitive', () => {
        expect(at('/cb?Access_Token=x&keep=1')).toBe(`${O}/cb?keep=1`)
    })

    it('keeps code and state by default — they are ordinary product parameters', () => {
        expect(at('/cb?code=SUMMER20&state=CA')).toBe(
            `${O}/cb?code=SUMMER20&state=CA`,
        )
    })

    it('strips code and state under the oauth preset', () => {
        const result = normalizeUrl('/cb?code=abc&state=xyz&keep=1', {
            origin: O,
            stripParams: 'oauth',
        })
        expect(result.url).toBe(`${O}/cb?keep=1`)
        expect(result.strippedParams).toEqual(['code', 'state'])
    })

    it('accepts a custom strip list', () => {
        expect(at('/cb?tenant=acme&keep=1', { stripParams: ['tenant'] })).toBe(
            `${O}/cb?keep=1`,
        )
    })

    it('disables stripping entirely with false', () => {
        expect(at('/cb?password=x', { stripParams: false })).toBe(
            `${O}/cb?password=x`,
        )
    })

    it('reports every stripped name once', () => {
        const result = normalizeUrl('/cb?password=a&otp=b&keep=1', {
            origin: O,
        })
        expect(result.strippedParams).toEqual(['password', 'otp'])
    })

    it('reports nothing when nothing was stripped', () => {
        expect(normalizeUrl('/a?q=1', { origin: O }).strippedParams).toEqual([])
    })
})

describe('normalizeUrl — length', () => {
    it('truncates past the limit and flags it', () => {
        const result = normalizeUrl(`/a?q=${'x'.repeat(MAX_URL_LENGTH)}`, {
            origin: O,
        })
        expect(result.url).toHaveLength(MAX_URL_LENGTH)
        expect(result.truncated).toBe(true)
    })

    it('does not flag a short URL', () => {
        expect(normalizeUrl('/a', { origin: O }).truncated).toBe(false)
    })

    it('honours a custom limit', () => {
        const result = normalizeUrl('/abcdefghijklmnop', {
            origin: O,
            maxLength: 25,
        })
        expect(result.url).toHaveLength(25)
        expect(result.truncated).toBe(true)
    })
})

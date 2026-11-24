import { describe, expect, it } from 'vitest'
import { cleanHistoryState, paramMatcher, removeParams } from './address.js'

const utm = paramMatcher('utm')!

describe('paramMatcher', () => {
    it('is off unless asked', () => {
        expect(paramMatcher(undefined)).toBeNull()
        expect(paramMatcher(false)).toBeNull()
        expect(paramMatcher([])).toBeNull()
    })

    it('expands the utm preset to every utm_* parameter', () => {
        for (const name of [
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_content',
            'utm_term',
            'utm_referrer',
        ])
            expect(utm(name)).toBe(true)
        expect(utm('utm')).toBe(false)
        expect(utm('yclid')).toBe(false)
        expect(utm('q')).toBe(false)
    })

    it('takes exact names and trailing-star prefixes', () => {
        const matches = paramMatcher(['utm_*', 'yclid'])!
        expect(matches('utm_source')).toBe(true)
        expect(matches('yclid')).toBe(true)
        expect(matches('yclid_extra')).toBe(false)
        expect(matches('gclid')).toBe(false)
    })

    it('ignores case on both sides', () => {
        expect(utm('UTM_Source')).toBe(true)
        expect(paramMatcher(['YCLID'])!('yclid')).toBe(true)
        expect(paramMatcher(['Ref_*'])!('REF_PARTNER')).toBe(true)
    })

    it('treats "utm" inside a list as a plain name, not the preset', () => {
        const matches = paramMatcher(['utm'])!
        expect(matches('utm')).toBe(true)
        expect(matches('utm_source')).toBe(false)
    })
})

describe('removeParams', () => {
    it('keeps the rest of the query, its order and the hash', () => {
        expect(
            removeParams(
                'https://shop.example/a?utm_source=x&q=1&utm_medium=y&page=2#reviews',
                utm,
            ),
        ).toEqual({
            url: 'https://shop.example/a?q=1&page=2#reviews',
            removed: ['utm_source', 'utm_medium'],
        })
    })

    it('drops the question mark when nothing is left', () => {
        expect(
            removeParams('https://shop.example/?utm_source=x#a', utm).url,
        ).toBe('https://shop.example/#a')
        expect(removeParams('/a?utm_source=x', utm).url).toBe('/a')
    })

    it('does not re-encode the parameters that stay', () => {
        expect(
            removeParams('/s?q=a+b&utm_term=x&tag=%D0%BC%D0%B5&raw=a%2Cb', utm)
                .url,
        ).toBe('/s?q=a+b&tag=%D0%BC%D0%B5&raw=a%2Cb')
    })

    it('returns the input untouched when nothing matches', () => {
        const href = 'https://shop.example/a?q=1&utm=2#utm_source=x'
        expect(removeParams(href, utm)).toEqual({ url: href, removed: [] })
        expect(removeParams('https://shop.example/a', utm)).toEqual({
            url: 'https://shop.example/a',
            removed: [],
        })
    })

    it('matches encoded names and names without a value, and reports each once', () => {
        expect(
            removeParams('/?utm%5Fsource=x&utm_medium&q=1&utm_source=y', utm),
        ).toEqual({ url: '/?q=1', removed: ['utm_source', 'utm_medium'] })
    })

    it('survives a malformed escape in a name', () => {
        expect(removeParams('/?%E0%A4%A=1&utm_source=x', utm).url).toBe(
            '/?%E0%A4%A=1',
        )
    })
})

describe('cleanHistoryState', () => {
    it('cleans the Pages Router copy of the address and keeps everything else', () => {
        const state = {
            __N: true,
            url: '/blog/[slug]?slug=hi&utm_source=x',
            as: '/blog/hi?utm_source=x&q=1',
            options: { locale: undefined },
            key: 'k1',
        }
        expect(cleanHistoryState(state, utm)).toEqual({
            __N: true,
            url: '/blog/[slug]?slug=hi',
            as: '/blog/hi?q=1',
            options: { locale: undefined },
            key: 'k1',
        })
        expect(state.as).toBe('/blog/hi?utm_source=x&q=1')
    })

    it('passes anything that is not an object through', () => {
        expect(cleanHistoryState(null, utm)).toBeNull()
        expect(cleanHistoryState('x', utm)).toBe('x')
    })
})

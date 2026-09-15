import { expect, test } from '../../fixtures/metrica'

test('the tag runs under a nonce-based strict-dynamic policy with no violations', async ({
    page,
    metrica,
}) => {
    await page.addInitScript(() => {
        const violations: string[] = []
        Object.defineProperty(window, '__cspViolations', { value: violations })
        document.addEventListener('securitypolicyviolation', event => {
            violations.push(`${event.violatedDirective} ${event.blockedURI}`)
        })
    })

    const response = await page.goto(metrica.path('/csp'))
    // Without the header this test would pass against an app with no policy at all.
    expect(response?.headers()['content-security-policy']).toContain(
        "'strict-dynamic'",
    )

    await metrica.expectHits([{ url: metrica.url('/csp') }])
    expect(metrica.requests).toContain('GET mc.yandex.ru/metrika/tag.js')
    expect(
        await page.evaluate(
            () =>
                (window as unknown as { __cspViolations: string[] })
                    .__cspViolations,
        ),
    ).toEqual([])
    await expect(
        page.locator('script:not([src])', { hasText: 'mc.yandex' }),
    ).toHaveCount(0)
})

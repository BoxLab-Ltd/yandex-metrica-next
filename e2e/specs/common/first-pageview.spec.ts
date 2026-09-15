import { counterId, expect, test } from '../../fixtures/metrica'

test('first load sends one pageview with the full url and the page title @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(
        metrica.path('/pricing?plan=pro&utm_source=e2e&access_token=secret'),
    )

    await metrica.expectHits([
        {
            url: metrica.url('/pricing?plan=pro&utm_source=e2e'),
            title: 'Pricing — Acme Shop',
        },
    ])

    const inits = metrica.forMethod('init')
    expect(inits).toHaveLength(1)
    expect(inits[0]?.args[0]).toMatchObject({
        defer: true,
        triggerEvent: true,
        webvisor: true,
    })
    expect(inits[0]?.counterId).toBe(counterId)
    await expect(
        page.locator('script[src="https://mc.yandex.ru/metrika/tag.js"]'),
    ).toHaveCount(1)
})

import { expect, test, variant } from '../../fixtures/metrica'

test('a CommonJS next.config.js requires the package to build a static policy', async ({
    page,
    metrica,
}) => {
    test.skip(
        variant !== 'cjs-config',
        'only this variant ships a CommonJS config',
    )

    const response = await page.goto(metrica.path('/pricing'))
    const policy = response?.headers()['content-security-policy'] ?? ''
    expect(policy).toContain('https://mc.yandex.md')
    expect(policy).toContain("'unsafe-inline'")

    // Any violation of that policy fails the fixture through the console error check.
    await metrica.expectHits([{ url: metrica.url('/pricing') }])
})

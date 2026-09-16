import { expect, isDev, test } from '../../fixtures/metrica'

// Checked in the consumer's real build: assert-prod-strip only proves it against a bundler oracle.
test('diagnostic messages reach development bundles and are stripped from production ones @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ url: metrica.url('/a') }])

    const bundle = await metrica.appScripts()

    // Without the package in the fetched chunks, a missing message would prove nothing.
    expect(bundle).toContain('@boxlab/yandex-metrica-next.registry.v1')
    if (isDev) expect(bundle).toContain('Route commits are arriving')
    else expect(bundle).not.toContain('Route commits are arriving')
})

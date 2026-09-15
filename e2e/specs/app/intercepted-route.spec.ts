import { expect, test } from '../../fixtures/metrica'

test('an intercepted route is a pageview of the url it shows', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/gallery'))
    await metrica.expectHits([{ url: metrica.url('/gallery') }])

    await page.getByRole('link', { name: 'Photo 1' }).click()
    await expect(page.getByRole('dialog', { name: 'Photo' })).toBeVisible()

    // Next keeps the underlying page's title under a soft-navigated modal; report what is shown.
    const shown = await page.title()
    await metrica.expectHits([
        { url: metrica.url('/gallery') },
        { url: metrica.url('/photo/1'), title: shown },
    ])

    await page.goBack()
    await expect(page.getByRole('dialog', { name: 'Photo' })).toBeHidden()

    await metrica.expectHits([
        { url: metrica.url('/gallery') },
        { url: metrica.url('/photo/1'), title: shown },
        { url: metrica.url('/gallery'), title: 'Gallery — Acme Shop' },
    ])
})

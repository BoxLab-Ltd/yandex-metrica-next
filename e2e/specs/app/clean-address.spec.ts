import { expect, test } from '../../fixtures/metrica'

// The App Router writes its own idea of the URL back on every state change; it has to learn the clean one.
test('router.refresh() does not bring the tags back', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a?utm_source=x&q=1'))
    await metrica.expectHits([{ url: metrica.url('/a?utm_source=x&q=1') }])
    await expect(page).toHaveURL(metrica.url('/a?q=1'))

    await page.getByRole('button', { name: 'router.refresh' }).click()
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(metrica.url('/a?q=1'))
    await metrica.expectHits([{ url: metrica.url('/a?utm_source=x&q=1') }])
})

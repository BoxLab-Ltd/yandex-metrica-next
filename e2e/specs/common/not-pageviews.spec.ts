import { expect, test } from '../../fixtures/metrica'

test('typing into a query-driven search is not a pageview', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/search'))
    const first = await metrica.expectHits([{ url: metrica.url('/search') }])

    await page.getByRole('searchbox').pressSequentially('metrica', {
        delay: 40,
    })
    await expect(page).toHaveURL(/\?q=metrica$/)

    await metrica.expectHits(first)
})

test('a hash change is not a pageview', async ({ page, metrica }) => {
    await page.goto(metrica.path('/a'))
    const first = await metrica.expectHits([{ url: metrica.url('/a') }])

    await page.getByRole('link', { name: 'Details' }).click()
    await expect(page).toHaveURL(/#details$/)

    await metrica.expectHits(first)
})

test('a push to the url already shown is not a pageview', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/b'))
    const first = await metrica.expectHits([{ url: metrica.url('/b') }])

    await page.getByRole('button', { name: 'router.push /b' }).click()

    await metrica.expectHits(first)
})

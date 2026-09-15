import { expect, test } from '../../fixtures/metrica'

test('a shallow push to a new query is not a pageview', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    const first = await metrica.expectHits([{ url: metrica.url('/a') }])

    await page.getByRole('button', { name: 'shallow push' }).click()
    await expect(page).toHaveURL(/\?tab=reviews$/)

    await metrica.expectHits(first)
})

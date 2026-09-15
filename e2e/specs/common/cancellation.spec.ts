import { expect, test } from '../../fixtures/metrica'

test('a server-side redirect reports only the destination', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/'))
    await metrica.expectHits([{ url: metrica.url('/') }])

    await page.getByRole('link', { name: 'Redirect' }).click()
    await expect(page).toHaveTitle('Page B — Acme Shop')

    await metrica.expectHits([
        { url: metrica.url('/') },
        { url: metrica.url('/b'), title: 'Page B — Acme Shop' },
    ])
})

test('a navigation superseded within milliseconds reports only the last url', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ url: metrica.url('/a') }])

    await page.getByRole('button', { name: 'double push' }).click()
    await expect(page).toHaveTitle('Pricing — Acme Shop')

    await metrica.expectHits([
        { url: metrica.url('/a') },
        { url: metrica.url('/pricing'), title: 'Pricing — Acme Shop' },
    ])
})

test('a slow navigation interrupted by another reports only the second', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/'))
    await metrica.expectHits([{ url: metrica.url('/') }])

    await page.getByRole('link', { name: 'Slow' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('link', { name: 'Fast' }).click()
    await expect(page).toHaveTitle('Fast — Acme Shop')

    // Longer than the slow page takes to render, so a late commit would have landed.
    await metrica.expectHits(
        [
            { url: metrica.url('/') },
            { url: metrica.url('/fast'), title: 'Fast — Acme Shop' },
        ],
        { grace: 2500 },
    )
    await expect(page).toHaveURL(metrica.url('/fast'))
})

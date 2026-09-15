import { test } from '../../fixtures/metrica'

test('a userland history.pushState is a pageview @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ url: metrica.url('/a') }])

    await page.getByRole('button', { name: 'history.pushState' }).click()

    await metrica.expectHits([
        { url: metrica.url('/a') },
        { url: metrica.url('/a/userland'), title: 'Page A — Acme Shop' },
    ])
})

test('router.refresh is not a pageview', async ({ page, metrica }) => {
    await page.goto(metrica.path('/a'))
    const first = await metrica.expectHits([{ url: metrica.url('/a') }])

    await page.getByRole('button', { name: 'router.refresh' }).click()

    await metrica.expectHits(first)
})

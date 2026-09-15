import { expect, test } from '../../fixtures/metrica'

const home = { title: 'Home — Acme Shop' }
const pageA = { title: 'Page A — Acme Shop' }
const pageB = { title: 'Page B — Acme Shop' }

test('a link reports the new page with its own title, not the previous one @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/'))
    await metrica.expectHits([{ ...home, url: metrica.url('/') }])

    await page.getByRole('link', { name: 'Pricing' }).click()
    await expect(page).toHaveTitle('Pricing — Acme Shop')

    await metrica.expectHits([
        { ...home, url: metrica.url('/') },
        { url: metrica.url('/pricing'), title: 'Pricing — Acme Shop' },
    ])
})

test('A → B → A is three pageviews, not two @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ ...pageA, url: metrica.url('/a') }])

    await page.getByRole('link', { name: 'Page B', exact: true }).click()
    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
    ])

    await page.getByRole('link', { name: 'Page A', exact: true }).click()
    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
        { ...pageA, url: metrica.url('/a') },
    ])
})

test('back and forward are pageviews', async ({ page, metrica }) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ ...pageA, url: metrica.url('/a') }])
    await page.getByRole('link', { name: 'Page B', exact: true }).click()
    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
    ])

    // Traversals inside commitDebounce collapse by design, so each step waits for its hit.
    await page.goBack()
    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
        { ...pageA, url: metrica.url('/a') },
    ])

    await page.goForward()
    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
    ])
})

test('router.replace is a pageview', async ({ page, metrica }) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ ...pageA, url: metrica.url('/a') }])

    await page.getByRole('button', { name: 'router.replace /b' }).click()

    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b') },
    ])
})

import { expect, test } from '../../fixtures/metrica'

const pageA = { title: 'Page A — Acme Shop' }
const pricing = { title: 'Pricing — Acme Shop' }
const pageB = { title: 'Page B — Acme Shop' }

test('campaign tags leave the address bar after the landing hit, which still carries them @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/pricing?utm_source=x&utm_medium=y&q=1#top'))

    await metrica.expectHits([
        {
            ...pricing,
            url: metrica.url('/pricing?utm_source=x&utm_medium=y&q=1'),
        },
    ])
    await expect(page).toHaveURL(metrica.url('/pricing?q=1#top'))
    expect(metrica.forMethod('hit')[0]?.location).toBe(
        metrica.url('/pricing?utm_source=x&utm_medium=y&q=1#top'),
    )

    await page.getByRole('link', { name: 'Page B', exact: true }).click()
    await metrica.expectHits([
        {
            ...pricing,
            url: metrica.url('/pricing?utm_source=x&utm_medium=y&q=1'),
        },
        { ...pageB, url: metrica.url('/b') },
    ])

    await page.goBack()
    await expect(page).toHaveURL(metrica.url('/pricing?q=1#top'))
    await metrica.expectHits([
        {
            ...pricing,
            url: metrica.url('/pricing?utm_source=x&utm_medium=y&q=1'),
        },
        { ...pageB, url: metrica.url('/b') },
        { ...pricing, url: metrica.url('/pricing?q=1') },
    ])

    await page.goForward()
    await expect(page).toHaveURL(metrica.url('/b'))
})

test('tags reached by client navigation leave after that hit @dev', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/a'))
    await metrica.expectHits([{ ...pageA, url: metrica.url('/a') }])

    await page.getByRole('link', { name: 'Tagged link' }).click()

    await metrica.expectHits([
        { ...pageA, url: metrica.url('/a') },
        { ...pageB, url: metrica.url('/b?utm_source=e2e&utm_medium=menu') },
    ])
    await expect(page).toHaveURL(metrica.url('/b'))
})

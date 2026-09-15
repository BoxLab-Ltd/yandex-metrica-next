import { counterId, expect, test } from '../../fixtures/metrica'

test('goals reach the tag from a hook and from a plain module', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/goals'))
    await metrica.expectHits([{ url: metrica.url('/goals') }])

    await page.getByRole('button', { name: 'Sign up' }).click()
    await page.getByRole('button', { name: 'Buy' }).click()

    await expect
        .poll(() => metrica.goals())
        .toEqual([
            { counterId, goal: 'sign-up' },
            {
                counterId,
                goal: 'purchase',
                params: { order_price: 990, currency: 'RUB' },
            },
        ])
})

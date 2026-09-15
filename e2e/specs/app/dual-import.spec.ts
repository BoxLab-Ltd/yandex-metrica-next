import { counterId, expect, test } from '../../fixtures/metrica'

test('the ESM and CommonJS builds share one runtime', async ({
    page,
    metrica,
}) => {
    await page.goto(metrica.path('/dual-import'))
    await metrica.expectHits([{ url: metrica.url('/dual-import') }])

    await page.getByRole('button', { name: 'Goal via ESM' }).click()
    await page.getByRole('button', { name: 'Goal via CommonJS' }).click()

    await expect
        .poll(() => metrica.goals())
        .toEqual([
            { counterId, goal: 'esm-goal' },
            { counterId, goal: 'cjs-goal' },
        ])
})

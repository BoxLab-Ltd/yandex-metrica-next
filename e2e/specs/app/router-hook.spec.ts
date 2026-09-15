import type { Page } from '@playwright/test'
import {
    expect,
    isDev,
    test,
    variant,
    type MetricaSpy,
} from '../../fixtures/metrica'

const ym304 = (metrica: MetricaSpy): string[] =>
    metrica.warnings.filter(warning => warning.includes('YM304'))

const visit = async (
    page: Page,
    metrica: MetricaSpy,
    link: string,
    pathname: string,
    count: number,
): Promise<void> => {
    await page.getByRole('link', { name: link, exact: true }).click()
    await expect(page).toHaveURL(metrica.url(pathname))
    await expect.poll(() => metrica.hits().length).toBe(count)
}

// YM304 is the only outside evidence that the hook ran: the pageview itself looks the same.
test.describe('the router hook @dev', () => {
    test.skip(!isDev, 'diagnostics are stripped from production builds')

    test('labels every navigation, including a slow one, so YM304 stays silent', async ({
        page,
        metrica,
    }) => {
        test.skip(variant === 'component', 'the component path has no hook')

        await page.goto(metrica.path('/a'))
        await expect.poll(() => metrica.hits().length).toBe(1)
        await visit(page, metrica, 'Page B', '/b', 2)
        await visit(page, metrica, 'Slow', '/slow', 3)
        await visit(page, metrica, 'Page A', '/a', 4)
        await visit(page, metrica, 'Slow', '/slow', 5)

        expect(ym304(metrica)).toEqual([])
    })

    test('without the hook, YM304 warns exactly once', async ({
        page,
        metrica,
    }) => {
        test.skip(variant !== 'component', 'only the component path lacks it')

        await page.goto(metrica.path('/a'))
        await expect.poll(() => metrica.hits().length).toBe(1)
        await visit(page, metrica, 'Page B', '/b', 2)
        await visit(page, metrica, 'Page A', '/a', 3)
        await visit(page, metrica, 'Page B', '/b', 4)

        await expect.poll(() => ym304(metrica)).toHaveLength(1)
    })
})

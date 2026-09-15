import { defineConfig, devices } from '@playwright/test'

const appDir = process.env.E2E_APP_DIR
if (appDir === undefined) {
    throw new Error(
        'E2E_APP_DIR is not set: run the suite through "node scripts/e2e.mjs run <cell>"',
    )
}

const app = process.env.E2E_APP ?? 'app-router'
const dev = process.env.E2E_ENV === 'dev'
const port = Number(process.env.E2E_PORT ?? '3456')
const basePath = process.env.E2E_BASE_PATH ?? ''
const nextArgs = process.env.E2E_NEXT_ARGS ?? ''

// Beneath any test code: a request that slips past the route handlers still cannot resolve.
const blockedHosts = [
    'mc.yandex.*',
    '*.mc.yandex.*',
    'mc.webvisor.*',
    'yastatic.net',
    'adstat.yandex.ru',
]

export default defineConfig({
    testDir: './e2e/specs',
    testMatch: [
        'common/**/*.spec.ts',
        `${app === 'pages-router' ? 'pages' : 'app'}/**/*.spec.ts`,
    ],
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: dev ? 90_000 : 30_000,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${port}`,
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        launchOptions: {
            args: [
                `--host-resolver-rules=${blockedHosts.map(host => `MAP ${host} ~NOTFOUND`).join(', ')}`,
            ],
        },
    },
    webServer: {
        command:
            `node node_modules/next/dist/bin/next ${dev ? 'dev' : 'start'} --port ${port} ${dev ? nextArgs : ''}`.trim(),
        cwd: appDir,
        url: `http://localhost:${port}${basePath}`,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
})

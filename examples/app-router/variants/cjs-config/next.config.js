const { metricaCsp } = require('@boxlab/yandex-metrica-next')

const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'blob:', 'data:'],
    'connect-src': ["'self'"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
}
for (const [name, sources] of Object.entries(metricaCsp({ webvisor: true }))) {
    directives[name] = [...(directives[name] ?? []), ...sources]
}
const policy = Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')

/** @type {import('next').NextConfig} */
module.exports = {
    basePath: process.env.E2E_BASE_PATH,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [{ key: 'Content-Security-Policy', value: policy }],
            },
        ]
    },
}

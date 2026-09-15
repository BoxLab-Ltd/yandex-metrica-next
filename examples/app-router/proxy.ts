import { NextResponse, type NextRequest } from 'next/server'
import { metricaCsp } from '@boxlab/yandex-metrica-next'

export function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const dev = process.env.NODE_ENV === 'development'

    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
            "'self'",
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            ...(dev ? ["'unsafe-eval'"] : []),
        ],
        'style-src': ["'self'", `'nonce-${nonce}'`],
        'img-src': ["'self'", 'blob:', 'data:'],
        // Declaring connect-src drops the default-src fallback, so RSC requests need 'self' here.
        'connect-src': ["'self'"],
        'font-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
    }
    // Merged, not appended: a directive repeated in one header is ignored after the first.
    for (const [name, sources] of Object.entries(
        metricaCsp({ strictDynamic: true, webvisor: true }),
    )) {
        directives[name] = [...(directives[name] ?? []), ...sources]
    }
    const policy = Object.entries(directives)
        .map(([name, sources]) => `${name} ${sources.join(' ')}`)
        .join('; ')

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', policy)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', policy)
    return response
}

export const config = {
    matcher: '/csp',
}

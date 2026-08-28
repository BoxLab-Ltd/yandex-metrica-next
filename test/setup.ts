import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom implements none of these three, and the package touches all of them.
vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
)

Object.defineProperty(navigator, 'sendBeacon', {
    value: vi.fn(() => true),
    configurable: true,
})

class SecurityPolicyViolationEventPolyfill extends Event {
    blockedURI = ''
    violatedDirective = ''
    effectiveDirective = ''
    disposition: 'enforce' | 'report' = 'enforce'
    documentURI = ''
    originalPolicy = ''
    referrer = ''
    sample = ''
    statusCode = 0
    sourceFile = ''
    lineNumber = 0
    columnNumber = 0

    constructor(type: string, init: Record<string, unknown> = {}) {
        super(type)
        Object.assign(this, init)
    }
}

if (!('SecurityPolicyViolationEvent' in globalThis)) {
    vi.stubGlobal(
        'SecurityPolicyViolationEvent',
        SecurityPolicyViolationEventPolyfill,
    )
}

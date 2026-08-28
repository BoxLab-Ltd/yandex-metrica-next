import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { diagnosticCodes, report } from './diagnostics.js'
import { createLogSink, resolveMode } from './mode.js'
import { resetMetricaRegistry } from '../testing/index.js'

beforeEach(() => {
    resetMetricaRegistry()
    delete (globalThis as { ym?: unknown }).ym
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('diagnostics', () => {
    it('ships exactly the thirteen v0.1 codes', () => {
        expect(diagnosticCodes).toHaveLength(13)
        expect(diagnosticCodes).not.toContain('YM501')
    })

    it('prints a code at most once', () => {
        expect(report('YM201')).not.toBeNull()
        expect(report('YM201')).toBeNull()
        expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('tracks each code independently', () => {
        report('YM201')
        expect(report('YM203')).not.toBeNull()
    })

    it('routes by level', () => {
        report('YM201')
        report('YM203')
        report('YM401')
        expect(console.error).toHaveBeenCalledTimes(1)
        expect(console.warn).toHaveBeenCalledTimes(1)
        expect(console.info).toHaveBeenCalledTimes(1)
    })

    it('appends detail to the message', () => {
        const diagnostic = report('YM401', { detail: 'Removed: password.' })
        expect(diagnostic?.message).toContain('Removed: password.')
    })

    it('carries a docs link per code', () => {
        expect(report('YM304')?.docs).toContain('docs/diagnostics.md#ym304')
    })

    it('stays silent when disabled', () => {
        expect(report('YM201', { enabled: false })).toBeNull()
        expect(console.error).not.toHaveBeenCalled()
    })

    it('notifies a programmatic listener', () => {
        const onDiagnostic = vi.fn()
        report('YM201', { onDiagnostic })
        expect(onDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'YM201' }),
        )
    })
})

describe('resolveMode', () => {
    it('logs outside production when no dev counter is set', () => {
        expect(resolveMode({ mode: 'auto', counterId: 1 })).toMatchObject({
            mode: 'log',
        })
    })

    it('sends to the dev counter outside production when one is set', () => {
        expect(
            resolveMode({ mode: 'auto', counterId: 1, devCounterId: 2 }),
        ).toMatchObject({
            mode: 'on',
            counterId: 2,
        })
    })

    it('off disables everything and reports no counter', () => {
        expect(resolveMode({ mode: 'off', counterId: 1 })).toEqual({
            mode: 'off',
            counterId: undefined,
            foreignYm: false,
        })
    })

    it('flags a foreign ym so log mode can leave it alone', () => {
        ;(globalThis as { ym?: unknown }).ym = () => {}
        expect(resolveMode({ mode: 'log', counterId: 1 }).foreignYm).toBe(true)
    })

    it('does not flag our own stub as foreign', () => {
        const stub = Object.assign(() => {}, { a: [], l: 1 })
        ;(globalThis as { ym?: unknown }).ym = stub
        expect(resolveMode({ mode: 'log', counterId: 1 }).foreignYm).toBe(false)
    })
})

describe('createLogSink', () => {
    it('prints the call instead of sending it', () => {
        const log = vi.fn()
        createLogSink({ log })({ counterId: 1, method: 'hit', args: ['/a'] })
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('hit'),
            expect.anything(),
        )
    })
})

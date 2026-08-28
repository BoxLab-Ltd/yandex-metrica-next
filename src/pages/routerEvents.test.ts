import { describe, expect, it, vi } from 'vitest'
import { trackPagesNavigation, type PagesRouterEvent } from './routerEvents.js'

type Handler = (...args: unknown[]) => void

const createEvents = () => {
    const handlers = new Map<PagesRouterEvent, Set<Handler>>()
    return {
        on(type: PagesRouterEvent, handler: Handler) {
            const set = handlers.get(type) ?? new Set<Handler>()
            set.add(handler)
            handlers.set(type, set)
        },
        off(type: PagesRouterEvent, handler: Handler) {
            handlers.get(type)?.delete(handler)
        },
        emit(type: PagesRouterEvent, ...args: unknown[]) {
            for (const handler of handlers.get(type) ?? []) handler(...args)
        },
        count(type: PagesRouterEvent) {
            return handlers.get(type)?.size ?? 0
        },
    }
}

describe('trackPagesNavigation', () => {
    it('arms a completed route change', () => {
        const events = createEvents()
        const arm = vi.fn()
        trackPagesNavigation(events, arm)

        events.emit('routeChangeComplete', '/b', { shallow: false })

        expect(arm).toHaveBeenCalledWith('/b', 'unknown')
    })

    it('reports a traverse when the change followed a popstate', () => {
        const events = createEvents()
        const arm = vi.fn()
        trackPagesNavigation(events, arm)

        window.dispatchEvent(new PopStateEvent('popstate'))
        events.emit('routeChangeComplete', '/a', { shallow: false })

        expect(arm).toHaveBeenCalledWith('/a', 'traverse')
    })

    it('does not carry the traverse label into the next navigation', () => {
        const events = createEvents()
        const arm = vi.fn()
        trackPagesNavigation(events, arm)

        window.dispatchEvent(new PopStateEvent('popstate'))
        events.emit('routeChangeComplete', '/a', { shallow: false })
        events.emit('routeChangeComplete', '/b', { shallow: false })

        expect(arm).toHaveBeenLastCalledWith('/b', 'unknown')
    })

    it('clears a pending traverse when the navigation is cancelled', () => {
        const events = createEvents()
        const arm = vi.fn()
        trackPagesNavigation(events, arm)

        window.dispatchEvent(new PopStateEvent('popstate'))
        events.emit(
            'routeChangeError',
            Object.assign(new Error('Route Cancelled'), { cancelled: true }),
            '/a',
            { shallow: false },
        )
        events.emit('routeChangeComplete', '/b', { shallow: false })

        expect(arm).toHaveBeenCalledWith('/b', 'unknown')
    })

    it('ignores a completion without a url', () => {
        const events = createEvents()
        const arm = vi.fn()
        trackPagesNavigation(events, arm)

        events.emit('routeChangeComplete')

        expect(arm).not.toHaveBeenCalled()
    })

    it('detaches every listener on dispose', () => {
        const events = createEvents()
        const arm = vi.fn()
        const dispose = trackPagesNavigation(events, arm)

        dispose()
        events.emit('routeChangeComplete', '/b', { shallow: false })
        window.dispatchEvent(new PopStateEvent('popstate'))

        expect(arm).not.toHaveBeenCalled()
        expect(events.count('routeChangeComplete')).toBe(0)
        expect(events.count('routeChangeError')).toBe(0)
    })
})

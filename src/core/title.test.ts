import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTitleSettler, DEFAULT_TITLE_TIMEOUT } from './title.js'

/** What React 19 does on navigation: drop the old <title> node and append a new one. */
const replaceTitleNode = (text: string): void => {
    document.head.querySelector('title')?.remove()
    const next = document.createElement('title')
    next.textContent = text
    document.head.append(next)
}

let settler: ReturnType<typeof createTitleSettler> | undefined

beforeEach(() => {
    vi.useFakeTimers()
    document.head.querySelector('title')?.remove()
    replaceTitleNode('initial')
})

afterEach(() => {
    settler?.dispose()
    settler = undefined
    vi.useRealTimers()
})

describe('createTitleSettler — settle mode', () => {
    it('resolves as soon as the title node is replaced', async () => {
        settler = createTitleSettler()
        const pending = settler.settle()

        replaceTitleNode('page-b')
        await vi.advanceTimersByTimeAsync(0)

        await expect(pending).resolves.toBe('page-b')
    })

    it('resolves when the replacement carries the same text', async () => {
        // probe 0.5: the node is replaced even when the text does not change,
        // so two pages sharing a title still produce two settled pageviews.
        document.title = 'page-b'
        settler = createTitleSettler()
        const pending = settler.settle()

        replaceTitleNode('page-b')
        await vi.advanceTimersByTimeAsync(0)

        await expect(pending).resolves.toBe('page-b')
    })

    it('falls back to the current title on timeout', async () => {
        settler = createTitleSettler()
        const pending = settler.settle()

        await vi.advanceTimersByTimeAsync(DEFAULT_TITLE_TIMEOUT + 1)

        await expect(pending).resolves.toBe('initial')
    })

    it('honours a custom timeout', async () => {
        settler = createTitleSettler({ timeout: 50 })
        const pending = settler.settle()

        await vi.advanceTimersByTimeAsync(51)

        await expect(pending).resolves.toBe('initial')
    })

    it('does not resolve before the node is replaced', async () => {
        settler = createTitleSettler()
        let resolved = false
        void settler.settle().then(() => void (resolved = true))

        await vi.advanceTimersByTimeAsync(10)
        expect(resolved).toBe(false)
    })

    it('serves several concurrent waiters from one replacement', async () => {
        settler = createTitleSettler()
        const first = settler.settle()
        const second = settler.settle()

        replaceTitleNode('page-c')
        await vi.advanceTimersByTimeAsync(0)

        await expect(Promise.all([first, second])).resolves.toEqual([
            'page-c',
            'page-c',
        ])
    })

    it('ignores head mutations that are not a title', async () => {
        settler = createTitleSettler()
        let resolved = false
        void settler.settle().then(() => void (resolved = true))

        document.head.append(document.createElement('meta'))
        await vi.advanceTimersByTimeAsync(10)

        expect(resolved).toBe(false)
    })
})

describe('createTitleSettler — flush and dispose', () => {
    it('flush resolves pending waits with the current title', async () => {
        settler = createTitleSettler()
        const pending = settler.settle()

        document.title = 'flushed'
        settler.flush()

        await expect(pending).resolves.toBe('flushed')
    })

    it('dispose resolves pending waits instead of leaving them hanging', async () => {
        settler = createTitleSettler()
        const pending = settler.settle()

        settler.dispose()

        await expect(pending).resolves.toBe('initial')
    })
})

describe('createTitleSettler — other modes', () => {
    it('immediate resolves synchronously with the current title', async () => {
        settler = createTitleSettler({ mode: 'immediate' })
        await expect(settler.settle()).resolves.toBe('initial')
    })

    it('false disables titles entirely', async () => {
        settler = createTitleSettler({ mode: false })
        await expect(settler.settle()).resolves.toBeUndefined()
    })
})

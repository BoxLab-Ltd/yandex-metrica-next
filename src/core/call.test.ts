import { describe, expect, it, vi } from 'vitest'
import type { BufferedCall } from './stub.js'
import { createCallBuffer } from './stub.js'
import { createCallPipeline } from './call.js'
import type { MetricaEvent } from './types/events.js'

const collect = () => {
    const sent: BufferedCall[] = []
    return { sent, send: (c: BufferedCall) => void sent.push(c) }
}

const pageview: MetricaEvent = {
    type: 'pageview',
    counterId: 1,
    url: 'https://a.example/x',
    title: 'X',
}

describe('createCallPipeline — mapping', () => {
    it.each<[MetricaEvent, string]>([
        [pageview, 'hit'],
        [{ type: 'goal', counterId: 1, goal: 'sign-up' }, 'reachGoal'],
        [{ type: 'params', counterId: 1, params: { plan: 'pro' } }, 'params'],
        [
            { type: 'userParams', counterId: 1, params: { UserID: 7 } },
            'userParams',
        ],
        [{ type: 'setUserID', counterId: 1, userId: '7' }, 'setUserID'],
        [
            { type: 'extLink', counterId: 1, url: 'https://b.example' },
            'extLink',
        ],
        [{ type: 'file', counterId: 1, url: '/a.pdf' }, 'file'],
        [{ type: 'notBounce', counterId: 1 }, 'notBounce'],
        [
            { type: 'addFileExtension', counterId: 1, extension: 'pdf' },
            'addFileExtension',
        ],
    ])('maps %s to the right ym method', (event, method) => {
        const { sent, send } = collect()
        createCallPipeline({ send, ready: true }).send(event)
        expect(sent[0]?.method).toBe(method)
    })

    it('passes hit options through', () => {
        const { sent, send } = collect()
        createCallPipeline({ send, ready: true }).send({
            ...pageview,
            referer: 'https://a.example/prev',
            params: { plan: 'pro' },
        })

        expect(sent[0]?.args[0]).toBe('https://a.example/x')
        expect(sent[0]?.args[1]).toEqual({
            title: 'X',
            referer: 'https://a.example/prev',
            params: { plan: 'pro' },
        })
    })
})

describe('createCallPipeline — beforeSend', () => {
    it('cancels the event when it returns null', () => {
        const { sent, send } = collect()
        const pipeline = createCallPipeline({
            send,
            ready: true,
            beforeSend: () => null,
        })

        expect(pipeline.send(pageview)).toBe(false)
        expect(sent).toHaveLength(0)
    })

    it('applies to every event type, not just pageviews', () => {
        const beforeSend = vi.fn(() => null)
        const { send } = collect()
        const pipeline = createCallPipeline({ send, ready: true, beforeSend })

        pipeline.send(pageview)
        pipeline.send({ type: 'goal', counterId: 1, goal: 'sign-up' })
        pipeline.send({ type: 'setUserID', counterId: 1, userId: '7' })

        expect(beforeSend).toHaveBeenCalledTimes(3)
    })

    it('sends the rewritten event, not the original', () => {
        const { sent, send } = collect()
        const pipeline = createCallPipeline({
            send,
            ready: true,
            beforeSend: event =>
                event.type === 'pageview'
                    ? { ...event, url: 'https://a.example/redacted' }
                    : event,
        })

        pipeline.send(pageview)
        expect(sent[0]?.args[0]).toBe('https://a.example/redacted')
    })

    it('a cancelled event leaves nothing in the buffer', () => {
        const { send } = collect()
        const pipeline = createCallPipeline({
            send,
            ready: false,
            beforeSend: () => null,
        })

        pipeline.send(pageview)
        expect(pipeline.buffered).toBe(0)
    })
})

describe('createCallPipeline — buffering', () => {
    it('holds calls until the tag is ready, then flushes in order', () => {
        const { sent, send } = collect()
        const pipeline = createCallPipeline({ send, ready: false })

        pipeline.send({ ...pageview, url: 'https://a.example/1' })
        pipeline.send({ ...pageview, url: 'https://a.example/2' })
        expect(sent).toHaveLength(0)
        expect(pipeline.buffered).toBe(2)

        pipeline.setReady(true)
        expect(sent.map(c => c.args[0])).toEqual([
            'https://a.example/1',
            'https://a.example/2',
        ])
        expect(pipeline.buffered).toBe(0)
    })

    it('sends straight through once ready', () => {
        const { sent, send } = collect()
        const pipeline = createCallPipeline({ send, ready: false })
        pipeline.setReady(true)
        pipeline.send(pageview)
        expect(sent).toHaveLength(1)
    })

    it('reports the call dropped on overflow', () => {
        const onDropped = vi.fn()
        const { send } = collect()
        const pipeline = createCallPipeline({
            send,
            ready: false,
            onDropped,
            buffer: createCallBuffer(1),
        })

        pipeline.send({ ...pageview, url: 'https://a.example/1' })
        pipeline.send({ ...pageview, url: 'https://a.example/2' })

        expect(onDropped).toHaveBeenCalledTimes(1)
        expect(onDropped.mock.calls[0]?.[0]).toMatchObject({
            args: ['https://a.example/1', expect.anything()],
        })
    })
})

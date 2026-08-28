import type { BeforeSend, MetricaEvent } from './types/events.js'
import type { BufferedCall, CallBuffer } from './stub.js'
import { createCallBuffer } from './stub.js'

export interface CallPipelineOptions {
    beforeSend?: BeforeSend
    /** Called for every event that reaches the tag; the default sends to the global ym. */
    send: (call: BufferedCall) => void
    /** Reports a call dropped because the buffer overflowed, for diagnostics. */
    onDropped?: (call: BufferedCall) => void
    ready?: boolean
    buffer?: CallBuffer
}

export interface CallPipeline {
    /** Returns false when beforeSend cancelled the event. */
    send(event: MetricaEvent): boolean
    setReady(ready: boolean): void
    readonly buffered: number
}

const toCall = (event: MetricaEvent): BufferedCall => {
    switch (event.type) {
        case 'pageview':
            return {
                counterId: event.counterId,
                method: 'hit',
                args: [
                    event.url,
                    {
                        title: event.title,
                        referer: event.referer,
                        params: event.params,
                    },
                ],
            }
        case 'goal':
            return {
                counterId: event.counterId,
                method: 'reachGoal',
                args: [event.goal, event.params, event.callback],
            }
        case 'params':
            return {
                counterId: event.counterId,
                method: 'params',
                args: [event.params],
            }
        case 'userParams':
            return {
                counterId: event.counterId,
                method: 'userParams',
                args: [event.params],
            }
        case 'setUserID':
            return {
                counterId: event.counterId,
                method: 'setUserID',
                args: [event.userId],
            }
        case 'extLink':
            return {
                counterId: event.counterId,
                method: 'extLink',
                args: [event.url, event.options],
            }
        case 'file':
            return {
                counterId: event.counterId,
                method: 'file',
                args: [event.url, event.options],
            }
        case 'notBounce':
            return {
                counterId: event.counterId,
                method: 'notBounce',
                args: [{ callback: event.callback }],
            }
        case 'addFileExtension':
            return {
                counterId: event.counterId,
                method: 'addFileExtension',
                args: [event.extension],
            }
    }
}

/**
 * Every outbound call goes through here. A second path would mean beforeSend applies to
 * some events and not others, which is exactly the kind of gap a privacy hook cannot have.
 */
export function createCallPipeline(options: CallPipelineOptions): CallPipeline {
    const buffer = options.buffer ?? createCallBuffer()
    let ready = options.ready ?? false

    const emit = (call: BufferedCall): void => {
        if (ready) {
            options.send(call)
            return
        }
        const { dropped } = buffer.push(call)
        if (dropped !== null) options.onDropped?.(dropped)
    }

    return {
        send(event) {
            const transformed = options.beforeSend
                ? options.beforeSend(event)
                : event
            if (transformed === null) return false
            emit(toCall(transformed))
            return true
        },
        setReady(next) {
            ready = next
            if (next) buffer.flush(options.send)
        },
        get buffered() {
            return buffer.size
        },
    }
}

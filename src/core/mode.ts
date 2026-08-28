import type { CounterId } from '../index.js'
import type { BufferedCall } from './stub.js'
import { hasForeignYm } from './stub.js'

export type MetricaMode = 'auto' | 'on' | 'log' | 'off'

export type ResolvedMode = 'on' | 'log' | 'off'

export interface ModeInput {
    mode?: MetricaMode
    counterId?: CounterId
    devCounterId?: CounterId
}

export interface ResolvedModeResult {
    mode: ResolvedMode
    /** The counter actually used: devCounterId wins outside production. */
    counterId: CounterId | undefined
    /** True when log mode must not replace an existing global ym. */
    foreignYm: boolean
}

declare const process: { env: { NODE_ENV?: string } }

const DEV = process.env.NODE_ENV !== 'production'

/**
 * `auto` sends in production, and outside it either sends to a dedicated dev counter or
 * logs instead. That is the answer to "nothing shows up in Metrica until we deploy":
 * without a dev counter there is nothing safe to send to, so we print instead of sending.
 */
export function resolveMode(input: ModeInput): ResolvedModeResult {
    const requested = input.mode ?? 'auto'
    const production = !DEV

    if (requested === 'off') {
        return { mode: 'off', counterId: undefined, foreignYm: false }
    }

    if (requested === 'auto') {
        if (production)
            return { mode: 'on', counterId: input.counterId, foreignYm: false }
        if (input.devCounterId !== undefined) {
            return {
                mode: 'on',
                counterId: input.devCounterId,
                foreignYm: false,
            }
        }
        return {
            mode: 'log',
            counterId: input.counterId,
            foreignYm: hasForeignYm(),
        }
    }

    if (requested === 'log') {
        return {
            mode: 'log',
            counterId: production
                ? input.counterId
                : (input.devCounterId ?? input.counterId),
            foreignYm: hasForeignYm(),
        }
    }

    return {
        mode: 'on',
        counterId: production
            ? input.counterId
            : (input.devCounterId ?? input.counterId),
        foreignYm: false,
    }
}

export interface LogSinkOptions {
    log?: (message: string, call: BufferedCall) => void
}

/**
 * Log mode prints what would have been sent and loads no tag at all. It never installs a
 * stub over a foreign `window.ym`: silencing someone else's analytics in dev — GTM, most
 * often — is not ours to do.
 */
export function createLogSink(
    options: LogSinkOptions = {},
): (call: BufferedCall) => void {
    const write =
        options.log ??
        ((message: string, call: BufferedCall) => {
            console.info(message, call.args)
        })

    return call => {
        write(
            `[yandex-metrica-next] ${call.method} → counter ${String(call.counterId)}`,
            call,
        )
    }
}

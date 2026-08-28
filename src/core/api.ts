import type { CounterId } from '../index.js'
import type {
    GoalArgs,
    GoalCallOptions,
    GoalName,
    ValidGoalId,
} from '../types/goals.js'
import type { MetricaEvent } from './types/events.js'
import type {
    UserParameters,
    VisitParameters,
    NoReservedKeys,
} from './types/params.js'
import type {
    ExtLinkOptions,
    FileOptions,
    HitOptions,
    NotBounceOptions,
} from './types/tag.js'
import type { BlockReason, CounterStatus } from './init.js'

export interface MetricaStatus {
    readonly state: CounterStatus | 'disabled'
    readonly counterId: CounterId | null
    readonly reason: BlockReason | undefined
    readonly pageviewsSent: number
    readonly bufferedCalls: number
}

export interface MetricaRuntime {
    counterId: CounterId | null
    send(event: MetricaEvent): boolean
    status(): MetricaStatus
    grant(): void
    revoke(): void
    destruct(): void
    /** Enriches the next commit with navigationType and transitionId. */
    arm(
        url: string,
        navigationType: 'push' | 'replace' | 'traverse',
        transitionId?: string | null,
    ): void
    /** Resolves with the tag's client id, or null on timeout. Never rejects. */
    clientId(timeout: number): Promise<string | null>
    ready(timeout: number): Promise<boolean>
}

const NOT_INSTALLED: MetricaStatus = {
    state: 'disabled',
    counterId: null,
    reason: undefined,
    pageviewsSent: 0,
    bufferedCalls: 0,
}

let runtime: MetricaRuntime | null = null

export function setRuntime(next: MetricaRuntime | null): void {
    runtime = next
}

export const DEFAULT_CLIENT_ID_TIMEOUT = 3000

const withCounter = (options?: { counterId?: CounterId }): CounterId | null =>
    options?.counterId ?? runtime?.counterId ?? null

const dispatch = (event: MetricaEvent | null): void => {
    if (event === null || runtime === null) return
    runtime.send(event)
}

const event = <T extends MetricaEvent>(
    counterId: CounterId | null,
    build: (counterId: CounterId) => T,
): T | null => (counterId === null ? null : build(counterId))

export function hit(
    url: string,
    options: HitOptions & { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'pageview' as const,
            counterId,
            url,
            title: options.title,
            referer: options.referer,
            params: options.params,
        })),
    )
}

export function reachGoal<K extends GoalName>(
    goal: K & ValidGoalId<K>,
    ...args: GoalArgs<K>
): void {
    const [params, options] = args as unknown as [
        VisitParameters | undefined,
        GoalCallOptions | undefined,
    ]
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'goal' as const,
            counterId,
            goal: String(goal),
            params,
            callback: options?.callback,
        })),
    )
}

/** Escape hatch for goal names computed at runtime; the registry is not consulted. */
export function reachGoalUnsafe(
    goal: string,
    params?: VisitParameters,
    options?: GoalCallOptions,
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'goal' as const,
            counterId,
            goal,
            params,
            callback: options?.callback,
        })),
    )
}

export function params<T extends VisitParameters>(
    parameters: T & NoReservedKeys<T>,
    options: { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'params' as const,
            counterId,
            params: parameters as VisitParameters,
        })),
    )
}

export function userParams<T extends UserParameters>(
    parameters: T & NoReservedKeys<T>,
    options: { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'userParams' as const,
            counterId,
            params: parameters as UserParameters,
        })),
    )
}

export function setUserID(
    userId: string | number,
    options: { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'setUserID' as const,
            counterId,
            userId: String(userId),
        })),
    )
}

export function notBounce(
    options: NotBounceOptions & { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'notBounce' as const,
            counterId,
            callback: options.callback,
        })),
    )
}

export function extLink(
    url: string,
    options: ExtLinkOptions & { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'extLink' as const,
            counterId,
            url,
            options,
        })),
    )
}

export function file(
    url: string,
    options: FileOptions & { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'file' as const,
            counterId,
            url,
            options,
        })),
    )
}

export function addFileExtension(
    extension: string | string[],
    options: { counterId?: CounterId } = {},
): void {
    dispatch(
        event(withCounter(options), counterId => ({
            type: 'addFileExtension' as const,
            counterId,
            extension,
        })),
    )
}

/**
 * Resolves null on timeout and never rejects: ad blockers are common enough that a
 * rejection here would take down any login flow that awaits the client id.
 */
export function getClientId(
    options: { counterId?: CounterId; timeout?: number } = {},
): Promise<string | null> {
    if (runtime === null) return Promise.resolve(null)
    return runtime.clientId(options.timeout ?? DEFAULT_CLIENT_ID_TIMEOUT)
}

export function whenReady(
    options: { counterId?: CounterId; timeout?: number } = {},
): Promise<boolean> {
    if (runtime === null) return Promise.resolve(false)
    return runtime.ready(options.timeout ?? DEFAULT_CLIENT_ID_TIMEOUT)
}

export function isReady(): boolean {
    return runtime?.status().state === 'ready'
}

/** Works everywhere, including the server and a blocked tag: the main diagnostic channel. */
export function getStatus(): MetricaStatus {
    return runtime?.status() ?? NOT_INSTALLED
}

export function armNavigation(
    url: string,
    navigationType: 'push' | 'replace' | 'traverse',
    transitionId?: string | null,
): void {
    runtime?.arm(url, navigationType, transitionId)
}

export function grantConsent(): void {
    runtime?.grant()
}

/** One-way in practice: Metrica does not guarantee a re-init of the same counter. */
export function revokeConsent(): void {
    runtime?.revoke()
}

export function destruct(): void {
    runtime?.destruct()
}

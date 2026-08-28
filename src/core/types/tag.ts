import type { CounterId } from '../../index.js'
import type { UserParameters, VisitParameters } from './params.js'

/**
 * Init parameters a user may set. `defer`, `trackHash`, `triggerEvent` and `sendTitle`
 * are removed on purpose: the package owns them. `defer: true` is what keeps the tag
 * from sending its own pageview before the router has settled.
 */
export interface InitParameters {
    childIframe?: boolean
    params?: VisitParameters | VisitParameters[]
    userParams?: UserParameters
    trustedDomains?: string[]
    /** 1 marks an advertising-network counter. */
    type?: 0 | 1 | (number & {})
    disableYtm?: boolean
    ssr?: boolean
}

/** Init parameters the package sets itself and the user cannot override. */
export interface ManagedInitParameters {
    defer: true
    triggerEvent: true
    clickmap?: boolean
    trackLinks?: boolean
    accurateTrackBounce?: boolean | number
    webvisor?: boolean
    ecommerce?: boolean | string
}

export interface HitOptions {
    title?: string
    referer?: string
    params?: VisitParameters
    callback?: () => void
    ctx?: unknown
}

export interface ExtLinkOptions {
    title?: string
    params?: VisitParameters
    callback?: () => void
    ctx?: unknown
}

export interface FileOptions extends ExtLinkOptions {
    referer?: string
}

export interface NotBounceOptions {
    callback?: () => void
    ctx?: unknown
}

export interface ReachGoalOptions {
    callback?: () => void
    ctx?: unknown
}

/**
 * The vendor surface, spelled out rather than typed as `any`. An exported `any` would
 * switch off checking for everyone using the low-level facade, which is the opposite
 * of what this package advertises.
 */
export interface YmFunction {
    (
        counterId: CounterId,
        method: 'init',
        parameters: InitParameters & ManagedInitParameters,
    ): void
    (
        counterId: CounterId,
        method: 'hit',
        url: string,
        options?: HitOptions,
    ): void
    (
        counterId: CounterId,
        method: 'reachGoal',
        target: string,
        params?: VisitParameters,
        callback?: () => void,
        ctx?: unknown,
    ): void
    (
        counterId: CounterId,
        method: 'extLink',
        url: string,
        options?: ExtLinkOptions,
    ): void
    (
        counterId: CounterId,
        method: 'file',
        url: string,
        options?: FileOptions,
    ): void
    (
        counterId: CounterId,
        method: 'notBounce',
        options?: NotBounceOptions,
    ): void
    (
        counterId: CounterId,
        method: 'params',
        parameters: VisitParameters | VisitParameters[],
    ): void
    (
        counterId: CounterId,
        method: 'userParams',
        parameters: UserParameters,
    ): void
    (counterId: CounterId, method: 'setUserID', userId: string): void
    (
        counterId: CounterId,
        method: 'getClientID',
        callback: (clientId: string) => void,
    ): void
    (
        counterId: CounterId,
        method: 'addFileExtension',
        extension: string | string[],
    ): void
    (counterId: CounterId, method: 'destruct'): void
}

export interface YmGlobal extends YmFunction {
    a?: IArguments[]
    l?: number
}

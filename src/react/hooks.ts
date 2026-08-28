'use client'

import { useSyncExternalStore } from 'react'
import type { MetricaStatus } from '../core/api.js'
import type { CounterId } from '../index.js'
import type { GoalArgs, GoalName, ValidGoalId } from '../types/goals.js'
import type {
    UserParameters,
    VisitParameters,
    NoReservedKeys,
} from '../core/types/params.js'
import type { HitOptions } from '../core/types/tag.js'
import {
    getStatus,
    hit,
    params,
    reachGoal,
    reachGoalUnsafe,
    setUserID,
    userParams,
} from '../core/api.js'

export interface MetricaApi {
    readonly counterId: CounterId | null
    hit(url: string, options?: HitOptions): void
    reachGoal<K extends GoalName>(
        goal: K & ValidGoalId<K>,
        ...args: GoalArgs<K>
    ): void
    reachGoalUnsafe(goal: string, parameters?: VisitParameters): void
    params<T extends VisitParameters>(parameters: T & NoReservedKeys<T>): void
    userParams<T extends UserParameters>(
        parameters: T & NoReservedKeys<T>,
    ): void
    setUserID(userId: string | number): void
}

const api: MetricaApi = {
    get counterId() {
        return getStatus().counterId
    },
    hit,
    reachGoal,
    reachGoalUnsafe,
    params,
    userParams,
    setUserID,
}

/**
 * Reads the global registry rather than a React context: on the instrumentation-client
 * path there is no provider at all, so a context would be a second source of truth that
 * disagrees with the first.
 */
export function useMetrica(): MetricaApi {
    return api
}

let cachedStatus = getStatus()

const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {}
    const id = window.setInterval(() => {
        const next = getStatus()
        if (
            next.state === cachedStatus.state &&
            next.pageviewsSent === cachedStatus.pageviewsSent
        ) {
            return
        }
        cachedStatus = next
        onChange()
    }, 250)
    return () => void window.clearInterval(id)
}

const getSnapshot = (): MetricaStatus => cachedStatus

/** Status works everywhere, including a blocked tag; it is the diagnostic channel in production. */
export function useMetricaStatus(): MetricaStatus {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

import type { MetricaGoalRegistry } from '../index.js'
import type { CounterId } from '../index.js'
import type { VisitParameters } from '../core/types/params.js'

export type GoalName = [keyof MetricaGoalRegistry] extends [never]
    ? string
    : Extract<keyof MetricaGoalRegistry, string>

export type ValidGoalId<S extends string> = S extends
    | `${string}/${string}`
    | `${string}\\${string}`
    | `${string}&${string}`
    | `${string}#${string}`
    | `${string}?${string}`
    | `${string}=${string}`
    | `${string}"${string}`
    ? {
          __metricaError: 'Goal id must not contain / \\ & # ? = " — encode + as %2B'
      }
    : S

export interface GoalCallOptions {
    counterId?: CounterId
    callback?: () => void
}

/**
 * Parameters become required when the goal declares them, so a goal carrying
 * `order_price` cannot be reported without it.
 */
export type GoalArgs<K extends string> = K extends keyof MetricaGoalRegistry
    ? MetricaGoalRegistry[K] extends void
        ? [params?: VisitParameters, options?: GoalCallOptions]
        : [
              params: MetricaGoalRegistry[K] & VisitParameters,
              options?: GoalCallOptions,
          ]
    : [params?: VisitParameters, options?: GoalCallOptions]

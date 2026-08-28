declare module '@boxlab/yandex-metrica-next' {
    interface MetricaGoalRegistry {
        'sign-up': void
        purchase: { order_price: number }
    }
}

import type {
    GoalArgs,
    GoalName,
    ValidGoalId,
} from '@boxlab/yandex-metrica-next'
import { useMetrica } from '@boxlab/yandex-metrica-next/react'
import { register } from '@boxlab/yandex-metrica-next/client'

declare function reachGoal<K extends GoalName>(
    goal: K & ValidGoalId<K>,
    ...args: GoalArgs<K>
): void

// Augmentation must reach the root entry.
reachGoal('sign-up')
reachGoal('purchase', { order_price: 990 })

// @ts-expect-error purchase declares parameters, so they are required
reachGoal('purchase')

// @ts-expect-error typo in a goal name must not compile
reachGoal('sing-up')

// @ts-expect-error goal ids may not contain reserved characters
reachGoal('a/b')

// The same union must be visible from a subpath, not just from the root.
const fromSubpath: GoalName = 'sign-up'
void fromSubpath
void useMetrica
void register({ counterId: 1 })

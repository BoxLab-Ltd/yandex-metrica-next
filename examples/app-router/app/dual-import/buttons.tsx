'use client'

import { reachGoalUnsafe } from '@boxlab/yandex-metrica-next'
import { useMetricaStatus } from '@boxlab/yandex-metrica-next/react'
import { trackFromCommonJs } from './legacy-tracker.cjs'

export function DualImportButtons() {
    const status = useMetricaStatus()

    return (
        <>
            <p>Status: {status.state}</p>
            <button onClick={() => reachGoalUnsafe('esm-goal')}>
                Goal via ESM
            </button>
            <button onClick={() => trackFromCommonJs('cjs-goal')}>
                Goal via CommonJS
            </button>
        </>
    )
}

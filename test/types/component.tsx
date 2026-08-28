import type { JSX, ReactElement } from 'react'
import { useRef } from 'react'
import { metricaCsp, type MetricaStatus } from '@boxlab/yandex-metrica-next'
import {
    useMetrica,
    useMetricaStatus,
    YandexMetrica,
} from '@boxlab/yandex-metrica-next/react'
import { YandexMetricaPages } from '@boxlab/yandex-metrica-next/pages'

// Every form below is deliberately one of the cross-version safe spellings: `JSX` imported
// rather than taken from the global namespace, `useRef` with an argument, `ReactElement`
// as the return type. The sentinels next to this file prove the two branches really differ.

export function AppRouterLayout(): JSX.Element {
    return (
        <>
            <YandexMetrica counterId={12345678} webvisor />
            <YandexMetrica counterId={12345678} noscript={false} mode='log' />
        </>
    )
}

export function PagesRouterApp(): ReactElement {
    return <YandexMetricaPages counterId={12345678} domain='com' />
}

export function GoalButton(): ReactElement {
    const button = useRef<HTMLButtonElement>(null)
    const metrica = useMetrica()
    const status: MetricaStatus = useMetricaStatus()

    return (
        <button
            ref={button}
            onClick={() => {
                metrica.reachGoalUnsafe('checkout-opened', { price: 990 })
            }}
        >
            {status.state}
        </button>
    )
}

void metricaCsp({ webvisor: true })

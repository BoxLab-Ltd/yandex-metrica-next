import * as Sentry from '@sentry/nextjs'
import {
    composeRouterTransitionStart,
    onRouterTransitionStart as metricaRouterTransitionStart,
    register,
} from '@boxlab/yandex-metrica-next/client'

Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })

register({
    counterId: Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID),
    devCounterId:
        Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_DEV_ID) || undefined,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
})

// Next reads a single onRouterTransitionStart export per file, and Sentry already needs it.
export const onRouterTransitionStart = composeRouterTransitionStart(
    Sentry.captureRouterTransitionStart,
    metricaRouterTransitionStart,
)

import { register } from '@boxlab/yandex-metrica-next/client'

register({
    counterId: Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID),
    devCounterId:
        Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_DEV_ID) || undefined,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
})

export { onRouterTransitionStart } from '@boxlab/yandex-metrica-next/client'

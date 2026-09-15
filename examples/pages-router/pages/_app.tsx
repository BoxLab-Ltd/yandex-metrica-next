import type { AppProps } from 'next/app'
import { YandexMetricaPages } from '@boxlab/yandex-metrica-next/pages'
import { Nav } from '../components/nav'

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <YandexMetricaPages
                counterId={Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID)}
                devCounterId={
                    Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_DEV_ID) ||
                    undefined
                }
                webvisor
                clickmap
                trackLinks
                accurateTrackBounce
            />
            <Nav />
            <main>
                <Component {...pageProps} />
            </main>
        </>
    )
}

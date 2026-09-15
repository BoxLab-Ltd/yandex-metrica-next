import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { YandexMetrica } from '@boxlab/yandex-metrica-next/react'
import { Nav } from './nav'

export const metadata: Metadata = {
    title: { default: 'Acme Shop', template: '%s — Acme Shop' },
}

export default function RootLayout({
    children,
    modal,
}: {
    children: ReactNode
    modal: ReactNode
}) {
    return (
        <html lang='en'>
            <body>
                <YandexMetrica
                    counterId={Number(
                        process.env.NEXT_PUBLIC_YANDEX_METRICA_ID,
                    )}
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
                <main>{children}</main>
                {modal}
            </body>
        </html>
    )
}

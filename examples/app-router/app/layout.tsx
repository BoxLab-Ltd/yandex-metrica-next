import type { Metadata } from 'next'
import type { ReactNode } from 'react'
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
                <Nav />
                <main>{children}</main>
                {modal}
            </body>
        </html>
    )
}

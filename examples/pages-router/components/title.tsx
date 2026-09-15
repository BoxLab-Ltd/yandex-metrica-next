import Head from 'next/head'

export function Title({ children }: { children: string }) {
    return (
        <Head>
            <title>{`${children} — Acme Shop`}</title>
        </Head>
    )
}

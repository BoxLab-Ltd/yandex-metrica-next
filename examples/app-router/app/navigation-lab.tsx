'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function NavigationLab() {
    const router = useRouter()

    return (
        <section aria-label='Navigation lab'>
            <button onClick={() => router.push('/b')}>router.push /b</button>
            <button onClick={() => router.replace('/b')}>
                router.replace /b
            </button>
            <button onClick={() => router.refresh()}>router.refresh</button>
            <button
                onClick={() =>
                    window.history.pushState(
                        null,
                        '',
                        `${window.location.pathname}/userland`,
                    )
                }
            >
                history.pushState
            </button>
            <button
                onClick={() => {
                    router.push('/b')
                    setTimeout(() => router.push('/pricing'), 20)
                }}
            >
                double push
            </button>
            <Link href='#details'>Details</Link>
            <p id='details'>Details</p>
        </section>
    )
}

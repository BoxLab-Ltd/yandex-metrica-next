import Link from 'next/link'
import { useRouter } from 'next/router'

export function NavigationLab() {
    const router = useRouter()

    return (
        <section aria-label='Navigation lab'>
            <button onClick={() => void router.push('/b')}>
                router.push /b
            </button>
            <button onClick={() => void router.replace('/b')}>
                router.replace /b
            </button>
            <button
                onClick={() =>
                    void router.push(
                        {
                            pathname: router.pathname,
                            query: { tab: 'reviews' },
                        },
                        undefined,
                        { shallow: true },
                    )
                }
            >
                shallow push
            </button>
            <button
                onClick={() => {
                    void router.push('/b')
                    setTimeout(() => void router.push('/pricing'), 20)
                }}
            >
                double push
            </button>
            <Link href='#details'>Details</Link>
            <p id='details'>Details</p>
        </section>
    )
}

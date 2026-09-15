import type { Metadata } from 'next'
import Link from 'next/link'

const posts: Record<string, string> = {
    'hello-metrica': 'Hello, Metrica',
    'second-post': 'Second post',
}

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
    return Object.keys(posts).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    return { title: posts[slug] ?? 'Blog' }
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params
    return (
        <article>
            <h1>{posts[slug] ?? 'Not found'}</h1>
            <Link href='/blog/second-post'>Next post</Link>
        </article>
    )
}

import type { Metadata } from 'next'
import { photoIds } from '../photos'

type Props = { params: Promise<{ id: string }> }

export function generateStaticParams() {
    return photoIds.map(id => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    return { title: `Photo ${id}` }
}

export default async function PhotoPage({ params }: Props) {
    const { id } = await params
    return <h1>Photo {id}</h1>
}

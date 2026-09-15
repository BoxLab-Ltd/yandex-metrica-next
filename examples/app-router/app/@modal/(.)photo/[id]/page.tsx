import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    return { title: `Photo ${id}` }
}

export default async function PhotoModal({ params }: Props) {
    const { id } = await params
    return (
        <dialog open aria-label='Photo'>
            Photo {id} in a modal
        </dialog>
    )
}

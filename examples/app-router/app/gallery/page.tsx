import type { Metadata } from 'next'
import Link from 'next/link'
import { photoIds } from '../photo/photos'

export const metadata: Metadata = { title: 'Gallery' }

export default function GalleryPage() {
    return (
        <>
            <h1>Gallery</h1>
            <ul>
                {photoIds.map(id => (
                    <li key={id}>
                        <Link href={`/photo/${id}`}>Photo {id}</Link>
                    </li>
                ))}
            </ul>
        </>
    )
}

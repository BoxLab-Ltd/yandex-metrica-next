import type { Metadata } from 'next'
import { NavigationLab } from '../navigation-lab'

export const metadata: Metadata = { title: 'Page A' }

export default function PageA() {
    return (
        <>
            <h1>Page A</h1>
            <NavigationLab />
        </>
    )
}

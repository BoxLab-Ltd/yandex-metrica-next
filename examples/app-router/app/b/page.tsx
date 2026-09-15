import type { Metadata } from 'next'
import { NavigationLab } from '../navigation-lab'

export const metadata: Metadata = { title: 'Page B' }

export default function PageB() {
    return (
        <>
            <h1>Page B</h1>
            <NavigationLab />
        </>
    )
}

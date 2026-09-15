import type { Metadata } from 'next'
import { DualImportButtons } from './buttons'

export const metadata: Metadata = { title: 'Dual import' }

export default function DualImportPage() {
    return (
        <>
            <h1>Dual import</h1>
            <DualImportButtons />
        </>
    )
}

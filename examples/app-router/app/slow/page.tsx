import type { Metadata } from 'next'
import { connection } from 'next/server'

export const metadata: Metadata = { title: 'Slow' }

export default async function SlowPage() {
    await connection()
    await new Promise(resolve => setTimeout(resolve, 1500))
    return <h1>Slow</h1>
}

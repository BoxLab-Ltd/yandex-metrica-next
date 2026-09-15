import type { Metadata } from 'next'
import { connection } from 'next/server'

export const metadata: Metadata = { title: 'CSP' }

export default async function CspPage() {
    // The nonce comes from the request, so this page cannot be prerendered.
    await connection()
    return <h1>CSP</h1>
}

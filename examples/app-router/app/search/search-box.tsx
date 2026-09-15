'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SearchBox() {
    const router = useRouter()
    const [query, setQuery] = useState('')

    return (
        <input
            type='search'
            aria-label='Search'
            value={query}
            onChange={event => {
                setQuery(event.target.value)
                router.replace(
                    `/search?q=${encodeURIComponent(event.target.value)}`,
                )
            }}
        />
    )
}

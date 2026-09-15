import { useRouter } from 'next/router'
import { useState } from 'react'
import { Title } from '../components/title'

export default function SearchPage() {
    const router = useRouter()
    const [query, setQuery] = useState('')

    return (
        <>
            <Title>Search</Title>
            <h1>Search</h1>
            <input
                type='search'
                aria-label='Search'
                value={query}
                onChange={event => {
                    setQuery(event.target.value)
                    void router.replace(
                        `/search?q=${encodeURIComponent(event.target.value)}`,
                        undefined,
                        { shallow: true },
                    )
                }}
            />
        </>
    )
}

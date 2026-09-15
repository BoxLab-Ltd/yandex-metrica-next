import type { Metadata } from 'next'
import { SearchBox } from './search-box'

export const metadata: Metadata = { title: 'Search' }

export default function SearchPage() {
    return (
        <>
            <h1>Search</h1>
            <SearchBox />
        </>
    )
}

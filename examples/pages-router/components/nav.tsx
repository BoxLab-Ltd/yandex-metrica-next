import Link from 'next/link'

const links = [
    ['/', 'Home'],
    ['/pricing', 'Pricing'],
    ['/search', 'Search'],
    ['/slow', 'Slow'],
    ['/fast', 'Fast'],
    ['/a', 'Page A'],
    ['/b', 'Page B'],
    ['/b?utm_source=e2e&utm_medium=menu', 'Tagged link'],
    ['/redirect', 'Redirect'],
    ['/goals', 'Goals'],
] as const

export function Nav() {
    return (
        <nav>
            <ul>
                {links.map(([href, label]) => (
                    <li key={href}>
                        <Link href={href}>{label}</Link>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

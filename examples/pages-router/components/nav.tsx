import Link from 'next/link'

const links = [
    ['/', 'Home'],
    ['/pricing', 'Pricing'],
    ['/search', 'Search'],
    ['/slow', 'Slow'],
    ['/fast', 'Fast'],
    ['/a', 'Page A'],
    ['/b', 'Page B'],
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

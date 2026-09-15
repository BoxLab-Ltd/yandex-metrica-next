import Link from 'next/link'

const links = [
    ['/', 'Home'],
    ['/pricing', 'Pricing'],
    ['/blog/hello-metrica', 'Blog'],
    ['/search', 'Search'],
    ['/slow', 'Slow'],
    ['/fast', 'Fast'],
    ['/a', 'Page A'],
    ['/b', 'Page B'],
    ['/redirect', 'Redirect'],
    ['/gallery', 'Gallery'],
    ['/goals', 'Goals'],
    ['/dual-import', 'Dual import'],
    ['/csp', 'CSP'],
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

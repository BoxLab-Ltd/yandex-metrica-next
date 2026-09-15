import type { GetServerSideProps } from 'next'
import { Title } from '../components/title'

export const getServerSideProps: GetServerSideProps = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    return { props: {} }
}

export default function SlowPage() {
    return (
        <>
            <Title>Slow</Title>
            <h1>Slow</h1>
        </>
    )
}

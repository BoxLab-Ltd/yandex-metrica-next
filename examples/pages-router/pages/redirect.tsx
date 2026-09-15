import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: { destination: '/b', permanent: false },
})

export default function RedirectPage() {
    return null
}

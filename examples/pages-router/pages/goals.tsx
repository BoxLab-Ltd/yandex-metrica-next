import { useMetrica } from '@boxlab/yandex-metrica-next/react'
import { addToCart } from '../lib/cart'
import { Title } from '../components/title'

export default function GoalsPage() {
    const metrica = useMetrica()

    return (
        <>
            <Title>Goals</Title>
            <h1>Goals</h1>
            <button onClick={() => metrica.reachGoal('sign-up')}>
                Sign up
            </button>
            <button onClick={() => addToCart(990)}>Buy</button>
        </>
    )
}

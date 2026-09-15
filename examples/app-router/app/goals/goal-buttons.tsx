'use client'

import { useMetrica } from '@boxlab/yandex-metrica-next/react'
import { addToCart } from './cart'

export function GoalButtons() {
    const metrica = useMetrica()

    return (
        <>
            <button onClick={() => metrica.reachGoal('sign-up')}>
                Sign up
            </button>
            <button onClick={() => addToCart(990)}>Buy</button>
        </>
    )
}

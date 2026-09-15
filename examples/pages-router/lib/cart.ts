import { reachGoal } from '@boxlab/yandex-metrica-next'

export function addToCart(price: number) {
    reachGoal('purchase', { order_price: price, currency: 'RUB' })
}

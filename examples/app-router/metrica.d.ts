export {}

declare module '@boxlab/yandex-metrica-next' {
    interface MetricaGoalRegistry {
        'sign-up': void
        purchase: { order_price: number; currency: 'RUB' }
    }
}

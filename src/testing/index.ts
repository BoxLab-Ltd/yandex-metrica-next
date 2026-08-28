export { installYmMock } from './installYmMock.js'
export type { YmCall, YmMock } from './installYmMock.js'

export function resetMetricaRegistry(): void {
    const g = globalThis as Record<symbol, unknown>
    delete g[Symbol.for('@boxlab/yandex-metrica-next.registry.v1')]
}

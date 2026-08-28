// Frozen forever: a different key means two independent registries when two copies of the
// package coexist, i.e. duplicate hits with no diagnostic. Compatibility goes through `schema`.
export const REGISTRY_KEY: unique symbol = Symbol.for(
    '@boxlab/yandex-metrica-next.registry.v1',
) as never

declare const __PKG_VERSION__: string
export const version: string = __PKG_VERSION__

export type CounterId = number

// Declared here rather than re-exported: `declare module` must merge with the interface
// declared in the file the specifier resolves to, or augmentation never reaches subpaths.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MetricaGoalRegistry {}

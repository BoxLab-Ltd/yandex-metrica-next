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

export type {
    GoalArgs,
    GoalCallOptions,
    GoalName,
    ValidGoalId,
} from './types/goals.js'

export type {
    CurrencyCode,
    MetricaValue,
    NoReservedKeys,
    ReservedVisitParamKey,
    UserParameters,
    VisitParameters,
} from './core/types/params.js'

export type {
    ExtLinkOptions,
    FileOptions,
    HitOptions,
    InitParameters,
    ManagedInitParameters,
    NotBounceOptions,
    ReachGoalOptions,
    YmFunction,
    YmGlobal,
} from './core/types/tag.js'

export {
    noscriptPixelUrl,
    TAG_JS_URL,
    TAG_JS_URL_COM,
    TAG_JS_URL_JSDELIVR,
} from './core/loader.js'

export type { MetricaDomain } from './core/loader.js'

export type { BlockReason, ConsentState, CounterStatus } from './core/init.js'

export type { MetricaMode } from './core/mode.js'

export type {
    Diagnostic,
    DiagnosticCode,
    DiagnosticLevel,
} from './core/diagnostics.js'

export type {
    BeforeSend,
    MetricaEvent,
    MetricaEventType,
} from './core/types/events.js'

export type {
    NavigationType,
    PageviewContext,
    PageviewOptions,
    PageviewTrigger,
} from './core/pageview.js'

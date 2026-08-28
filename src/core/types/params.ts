export type CurrencyCode =
    'RUB' | 'USD' | 'EUR' | 'BYN' | 'KZT' | 'UAH' | (string & {})

/** Everything that survives a JSON round-trip — the only shape Metrica accepts. */
export type MetricaValue =
    | string
    | number
    | boolean
    | null
    | readonly MetricaValue[]
    | { readonly [key: string]: MetricaValue }

export interface VisitParameters {
    order_price?: number
    price?: number
    currency?: CurrencyCode
    [key: string]: MetricaValue | undefined
}

export interface UserParameters {
    UserID?: string | number
    [key: string]: MetricaValue | undefined
}

/** Keys Metrica reserves for ecommerce and internals; writes to them are silently lost. */
export type ReservedVisitParamKey =
    | '__ym'
    | '__ymu'
    | 'currencyCode'
    | 'impressions'
    | 'click'
    | 'detail'
    | 'add'
    | 'remove'
    | 'checkout'
    | 'purchase'
    | 'promoView'
    | 'promoClick'

/**
 * `T` is inferred from the first member of the intersection at the call site, so the
 * check actually fires. Written as a bare parameter type it would never infer and the
 * conditional would silently resolve to the constraint.
 */
export type NoReservedKeys<T> =
    Extract<keyof T, ReservedVisitParamKey> extends never
        ? T
        : {
              __metricaError: `Reserved key: ${Extract<keyof T, ReservedVisitParamKey> & string}`
          }

import type { CounterId } from '../../index.js'
import type { ExtLinkOptions, FileOptions, HitOptions } from './tag.js'
import type { UserParameters, VisitParameters } from './params.js'

export type MetricaEvent =
    | {
          type: 'pageview'
          counterId: CounterId
          url: string
          title?: string
          referer?: string
          params?: VisitParameters
      }
    | {
          type: 'goal'
          counterId: CounterId
          goal: string
          params?: VisitParameters
          callback?: () => void
      }
    | {
          type: 'params'
          counterId: CounterId
          params: VisitParameters | VisitParameters[]
      }
    | { type: 'userParams'; counterId: CounterId; params: UserParameters }
    | { type: 'setUserID'; counterId: CounterId; userId: string }
    | {
          type: 'extLink'
          counterId: CounterId
          url: string
          options?: ExtLinkOptions
      }
    | { type: 'file'; counterId: CounterId; url: string; options?: FileOptions }
    | { type: 'notBounce'; counterId: CounterId; callback?: () => void }
    | {
          type: 'addFileExtension'
          counterId: CounterId
          extension: string | string[]
      }

export type MetricaEventType = MetricaEvent['type']

/** Returning null cancels the event; it is the only cancellation point in the package. */
export type BeforeSend = (event: MetricaEvent) => MetricaEvent | null

export type PageviewOptionsSubset = Pick<
    Extract<MetricaEvent, { type: 'pageview' }>,
    'url' | 'title' | 'referer' | 'params'
>

export type { HitOptions }

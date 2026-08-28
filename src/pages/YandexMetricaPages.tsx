'use client'

import { useEffect, type JSX } from 'react'
import Router from 'next/router'
import { armNavigation } from '../core/api.js'
import {
    YandexMetrica,
    type YandexMetricaProps,
} from '../react/YandexMetrica.js'
import { trackPagesNavigation } from './routerEvents.js'

/**
 * Place in `pages/_app.tsx`. Everything the App Router component does applies here too;
 * the difference is the navigation adapter, because `onRouterTransitionStart` is never
 * called under the Pages Router — the injected module runs, the hook does not.
 */
export function YandexMetricaPages(props: YandexMetricaProps): JSX.Element {
    useEffect(() => trackPagesNavigation(Router.events, armNavigation), [])

    return <YandexMetrica {...props} />
}

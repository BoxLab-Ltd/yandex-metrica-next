'use client'

import { useEffect, type JSX } from 'react'
import type { MetricaConfig } from '../core/register.js'
import type { PageviewOptions } from '../core/pageview.js'
import { register } from '../core/register.js'
import { noscriptPixelUrl } from '../core/loader.js'

/**
 * Pageview options that survive the RSC boundary. Functions do not, so `shouldTrack`
 * and `transformUrl` are absent by type rather than by documentation — passing one
 * from a Server Component is a runtime error, and the type should say so first.
 */
export type SerializablePageviewOptions = Omit<
    PageviewOptions,
    'shouldTrack' | 'transformUrl'
>

export type YandexMetricaProps = Omit<
    MetricaConfig,
    'beforeSend' | 'onReady' | 'onDiagnostic' | 'pageviews'
> & {
    pageviews?: false | SerializablePageviewOptions
    /** Render the <noscript> pixel. Only meaningful here: the client entry has no render. */
    noscript?: boolean
}

/**
 * Place as a sibling of {children}, never as a wrapper: wrapping {children} in the root
 * layout turns the whole tree into client components.
 *
 * Returns an element rather than null because it genuinely renders the <noscript> pixel.
 */
export function YandexMetrica({
    noscript = true,
    ...config
}: YandexMetricaProps): JSX.Element {
    const { counterId, devCounterId } = config
    const serialized = JSON.stringify(config)

    useEffect(() => {
        const handle = register(JSON.parse(serialized) as MetricaConfig)
        // dispose() detaches listeners; it deliberately does not call destruct, because
        // Metrica does not guarantee that the same counter can be initialised again.
        return () => void handle.dispose()
    }, [serialized])

    // register() refuses a non-integer counterId; the pixel has to hold the same line,
    // because here the value is interpolated into HTML instead of handed to the tag.
    const pixelFor = Number(devCounterId ?? counterId)
    if (!noscript || !Number.isInteger(pixelFor) || pixelFor <= 0) return <></>

    // React only renders <noscript> children during SSR; on the client the element comes
    // out empty. The markup has to be injected as a string, exactly as the vendor snippet
    // does. Both interpolated values are constrained — an integer and a 'ru' | 'com' union.
    const pixel = noscriptPixelUrl(pixelFor, { domain: config.domain })
    return (
        <noscript
            dangerouslySetInnerHTML={{
                __html: `<div><img src="${pixel}" style="position:absolute; left:-9999px;" alt="" /></div>`,
            }}
        />
    )
}

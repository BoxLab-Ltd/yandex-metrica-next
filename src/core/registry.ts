import { REGISTRY_KEY, type CounterId, version } from '../index.js'
import type { MetricaRuntime } from './api.js'

export type CounterState = {
    counterId: CounterId
    status:
        | 'idle'
        | 'consent-pending'
        | 'loading'
        | 'ready'
        | 'blocked'
        | 'destroyed'
    reason?:
        | 'csp'
        | 'adblock'
        | 'timeout'
        | 'consent-denied'
        | 'no-counter-id'
        | 'server'
    pageviewsSent: number
}

export interface Registry {
    schema: 1
    /** version -> how many copies of that version registered. */
    copies: Map<string, number>
    counters: Map<CounterId, CounterState>
    /** Owner token of the single active pageview tracker. */
    trackerOwner: symbol | null
    lastCommittedUrl: string | null
    lastCommittedAt: number
    /** Diagnostic codes already printed, so each is printed exactly once. */
    seenDiagnostics: Set<string>
    /** The registered runtime. Shared, so a CJS copy of the package reaches the same counter. */
    runtime: MetricaRuntime | null
    /** Tag state per counter; outlives registrations, since tag.js announces a counter only once. */
    tags: Map<CounterId, 'loading' | 'ready'>
}

const createRegistry = (): Registry => ({
    schema: 1,
    copies: new Map(),
    counters: new Map(),
    trackerOwner: null,
    lastCommittedUrl: null,
    lastCommittedAt: 0,
    seenDiagnostics: new Set(),
    runtime: null,
    tags: new Map(),
})

type Host = Record<symbol, Registry | undefined>

// Per module instance, so the number answers "how many copies of the package are loaded"
// rather than "how many times did someone ask for the registry".
const counted = new WeakSet<Registry>()

/**
 * State lives on globalThis, not in a module variable: ESM and CJS resolve to different
 * module instances, and pnpm can install two copies of the package. A module-level
 * registry would give each of them its own state and duplicate every hit silently.
 */
export function getRegistry(): Registry {
    const host = globalThis as Host
    let registry = host[REGISTRY_KEY]
    if (registry === undefined) {
        registry = createRegistry()
        host[REGISTRY_KEY] = registry
    }
    if (!counted.has(registry)) {
        counted.add(registry)
        registry.copies.set(version, (registry.copies.get(version) ?? 0) + 1)
    }
    return registry
}

/** Reads the registry without creating it or counting a copy. */
export function peekRegistry(): Registry | undefined {
    return (globalThis as Host)[REGISTRY_KEY]
}

export function countCopies(registry: Registry): number {
    let total = 0
    for (const count of registry.copies.values()) total += count
    return total
}

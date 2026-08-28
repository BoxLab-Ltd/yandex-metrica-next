import { useRef } from 'react'

// Compiles under @types/react@18 and must NOT compile under 19. If this file ever passes
// on the 19 branch, the paths mapping silently resolved to the wrong types and the whole
// two-branch run is checking one branch twice.

// The global JSX namespace was removed in @types/react@19 (TS2503).
export function element(): JSX.Element {
    return <div />
}

// useRef without an argument became an error in @types/react@19 (TS2554).
export function useSlot(): unknown {
    return useRef<string>()
}

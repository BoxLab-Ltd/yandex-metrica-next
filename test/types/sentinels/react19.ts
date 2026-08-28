import type { ReactNode } from 'react'

// Compiles under @types/react@19 and must NOT compile under 18: ReactNode only started
// accepting a Promise in 19 (TS2322 on the 18 branch). The mirror of react18.tsx — between
// them they prove each branch resolves the types it claims to.
export const pending: ReactNode = Promise.resolve('done')

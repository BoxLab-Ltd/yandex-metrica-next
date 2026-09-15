import type { Metadata } from 'next'
import { GoalButtons } from './goal-buttons'

export const metadata: Metadata = { title: 'Goals' }

export default function GoalsPage() {
    return (
        <>
            <h1>Goals</h1>
            <GoalButtons />
        </>
    )
}

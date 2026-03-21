/**
 * Local type definitions for dashboard journey stage display.
 * TODO: Replace with import from '@/lib/sessions/deriveJourneyStage' once CC1 merges.
 */

export type StageKey =
  | 'BRIEF_INCOMPLETE'
  | 'RESEARCHING'
  | 'RESULTS_READY'
  | 'SHORTLISTING'
  | 'VISIT_UPCOMING'
  | 'DEBRIEF_PENDING'
  | 'DECIDING'

export type Urgency = 'HIGH' | 'NORMAL'

export interface JourneyStageResult {
  stage: StageKey
  label: string
  urgency: Urgency
  statusLine: string
  ctaLabel: string
  ctaRoute: string
}

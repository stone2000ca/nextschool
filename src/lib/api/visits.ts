import { createClient } from '@/lib/supabase/client'
import type { VisitRecord } from '@/lib/sessions/deriveJourneyStage'

/**
 * Fetch visit records for multiple school journeys in a single query.
 * Uses school_journey_id as the join key between school_journeys and visit_records.
 *
 * @param schoolJourneyIds - Array of school_journey_id values
 * @returns VisitRecord[] mapped to the lightweight shape used by deriveJourneyStage
 */
export async function fetchVisitsByJourneyIds(
  schoolJourneyIds: string[]
): Promise<VisitRecord[]> {
  if (schoolJourneyIds.length === 0) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('visit_records')
    .select('id, school_journey_id, visit_date, status, impression, school:schools!school_id(name)')
    .in('school_journey_id', schoolJourneyIds)

  if (error) {
    console.error('[fetchVisitsByJourneyIds] Supabase error:', error.message)
    return []
  }

  if (!data) return []

  return data.map((row: any) => ({
    id: row.id,
    schoolJourneyId: row.school_journey_id,
    schoolName: row.school?.name ?? 'Unknown school',
    scheduledDate: row.visit_date,
    attended: row.status === 'debrief_pending' || row.status === 'completed',
    debriefSubmitted: row.status === 'completed',
  }))
}

/**
 * Lightweight visit record with family_journey_id for dashboard grouping.
 */
export interface DashboardVisitRecord extends VisitRecord {
  familyJourneyId: string | null
}

/**
 * Fetch all visit records for the current user (via denormalized user_id).
 * Joins through school_journeys to get family_journey_id for session grouping.
 * Used by Dashboard — no joins through chat_history.
 *
 * @param userId - The authenticated user's ID
 * @returns DashboardVisitRecord[] with familyJourneyId for grouping by session
 */
export async function fetchVisitsForUser(
  userId: string
): Promise<DashboardVisitRecord[]> {
  if (!userId) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('visit_records')
    .select('id, school_journey_id, visit_date, status, impression, school:schools!school_id(name), school_journey:school_journeys!school_journey_id(family_journey_id)')
    .eq('user_id', userId)

  if (error) {
    console.error('[fetchVisitsForUser] Supabase error:', error.message)
    return []
  }

  if (!data) return []

  return data.map((row: any) => ({
    id: row.id,
    schoolJourneyId: row.school_journey_id,
    familyJourneyId: row.school_journey?.family_journey_id ?? null,
    schoolName: row.school?.name ?? 'Unknown school',
    scheduledDate: row.visit_date,
    attended: row.status === 'debrief_pending' || row.status === 'completed',
    debriefSubmitted: row.status === 'completed',
  }))
}

/**
 * Check which sessions have at least one deep-dive analysis artifact.
 * Returns a Set of chat_history_ids that have deep dives.
 *
 * @param chatHistoryIds - Array of chat_history_id (= conversation_id) values
 * @returns Set<string> of chat_history_ids with deep-dive artifacts
 */
export async function fetchDeepDiveFlags(
  chatHistoryIds: string[]
): Promise<Set<string>> {
  if (chatHistoryIds.length === 0) return new Set()

  const supabase = createClient()

  const { data, error } = await supabase
    .from('conversation_artifacts')
    .select('conversation_id')
    .in('conversation_id', chatHistoryIds)
    .eq('artifact_type', 'deep_dive_analysis')

  if (error) {
    console.error('[fetchDeepDiveFlags] Supabase error:', error.message)
    return new Set()
  }

  return new Set((data ?? []).map((row: any) => row.conversation_id as string))
}

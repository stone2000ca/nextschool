import { createClient } from '@/lib/supabase/client'
import type { VisitRecord } from '@/lib/sessions/deriveJourneyStage'

/**
 * Fetch visit records for multiple sessions in a single query.
 * Uses chat_history_id as the join key between chat_sessions and visit_records.
 *
 * @param chatHistoryIds - Array of chat_history_id values from ChatSessionRecords
 * @returns VisitRecord[] mapped to the lightweight shape used by deriveJourneyStage
 */
export async function fetchVisitsBySessionIds(
  chatHistoryIds: string[]
): Promise<VisitRecord[]> {
  if (chatHistoryIds.length === 0) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('visit_records')
    .select('id, chat_history_id, visit_date, status, impression, school:schools!school_id(name)')
    .in('chat_history_id', chatHistoryIds)

  if (error) {
    console.error('[fetchVisitsBySessionIds] Supabase error:', error.message)
    return []
  }

  if (!data) return []

  return data.map((row: any) => ({
    id: row.id,
    sessionId: row.chat_history_id,
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

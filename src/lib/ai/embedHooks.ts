/**
 * Embed-at-write hooks: fire-and-forget functions that generate embeddings
 * and store them alongside records when data is created or updated.
 *
 * All functions are non-blocking (fire-and-forget) and never throw.
 * They log errors but don't propagate them to callers.
 */

import { generateEmbedding } from './generateEmbedding'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * Update the embedding column for a row in the given table.
 */
async function updateEmbedding(table: string, id: string, text: string): Promise<void> {
  const embedding = await generateEmbedding(text)
  if (!embedding) return

  const client = getAdminClient()
  const vectorLiteral = `[${embedding.join(',')}]`

  // Use raw SQL to set the vector column since supabase-js doesn't natively handle vector types
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error(`[embedHooks] Missing Supabase credentials`)
    return
  }

  // Try direct update via PostgREST — pgvector columns accept text format
  const { error } = await (client.from(table) as any)
    .update({ embedding: vectorLiteral })
    .eq('id', id)

  if (error) {
    console.error(`[embedHooks] Failed to update embedding for ${table}/${id}:`, error.message)
  }
}

// ─── Public embed hooks ──────────────────────────────────────────────

/**
 * Embed a school record: name + description + key attributes.
 * Call after School.create() or School.update().
 */
export function embedSchool(schoolId: string, schoolData: {
  name?: string
  description?: string
  city?: string
  school_type_label?: string
  grades_served?: string
  curriculum?: string[]
  specializations?: string[]
  teaching_philosophy?: string
}): void {
  const parts = [
    schoolData.name,
    schoolData.description,
    schoolData.city ? `Located in ${schoolData.city}` : null,
    schoolData.school_type_label,
    schoolData.grades_served ? `Grades: ${schoolData.grades_served}` : null,
    schoolData.curriculum?.length ? `Curriculum: ${schoolData.curriculum.join(', ')}` : null,
    schoolData.specializations?.length ? `Specializations: ${schoolData.specializations.join(', ')}` : null,
    schoolData.teaching_philosophy,
  ].filter(Boolean)

  const text = parts.join('. ')
  if (!text.trim()) return

  // Fire and forget
  updateEmbedding('schools', schoolId, text).catch(err =>
    console.error('[embedSchool] Failed:', err?.message)
  )
}

/**
 * Embed a school analysis record: narrative content.
 * Call after SchoolAnalysis.create() or SchoolAnalysis.update().
 */
export function embedSchoolAnalysis(analysisId: string, analysisData: {
  narrative?: string
  fit_label?: string
  strengths?: string[]
  trade_offs?: any[]
  school_name?: string
}): void {
  const parts = [
    analysisData.school_name ? `Analysis of ${analysisData.school_name}` : null,
    analysisData.fit_label ? `Fit: ${analysisData.fit_label}` : null,
    analysisData.narrative,
    analysisData.strengths?.length ? `Strengths: ${analysisData.strengths.join(', ')}` : null,
    analysisData.trade_offs?.length
      ? `Trade-offs: ${analysisData.trade_offs.map((t: any) => `${t.dimension}: ${t.concern || ''}`).join('; ')}`
      : null,
  ].filter(Boolean)

  const text = parts.join('. ')
  if (!text.trim()) return

  updateEmbedding('school_analyses', analysisId, text).catch(err =>
    console.error('[embedSchoolAnalysis] Failed:', err?.message)
  )
}

/**
 * Embed a conversation summary.
 * Call after ConversationSummary.create() or ConversationSummary.update().
 */
export function embedConversationSummary(summaryId: string, summaryData: {
  summary?: string
}): void {
  const text = summaryData.summary?.trim()
  if (!text) return

  updateEmbedding('conversation_summaries', summaryId, text).catch(err =>
    console.error('[embedConversationSummary] Failed:', err?.message)
  )
}

/**
 * Embed a visit record debrief: standout moments + concerns.
 * Call after visit record debrief fields are written.
 */
export function embedVisitRecord(recordId: string, recordData: {
  standout_moments?: string
  concerns?: string
  impression?: string
}): void {
  const parts = [
    recordData.impression ? `Overall impression: ${recordData.impression}` : null,
    recordData.standout_moments ? `Standout moments: ${recordData.standout_moments}` : null,
    recordData.concerns ? `Concerns: ${recordData.concerns}` : null,
  ].filter(Boolean)

  const text = parts.join('. ')
  if (!text.trim()) return

  updateEmbedding('visit_records', recordId, text).catch(err =>
    console.error('[embedVisitRecord] Failed:', err?.message)
  )
}

import { getAdminClient } from '@/lib/supabase/admin'
import { embedVisitRecord } from '@/lib/ai/embedHooks'

const db = () => getAdminClient().from('visit_records') as any

/**
 * Determine initial status based on visit_date.
 * - No date → 'upcoming' (stays indefinitely)
 * - Future date → 'upcoming'
 * - Today or past → 'debrief_pending'
 */
function initialStatus(visitDate: string | null | undefined): string {
  if (!visitDate) return 'upcoming'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const vd = new Date(visitDate + 'T00:00:00')
  return vd <= today ? 'debrief_pending' : 'upcoming'
}

/**
 * Create a visit record.
 */
export async function createVisitRecord(params: {
  user_id: string
  school_id: string
  school_journey_id?: string | null
  event_type: string
  visit_date?: string | null
  prep_notes?: string | null
}) {
  const { user_id, school_id, school_journey_id, event_type, visit_date, prep_notes } = params

  if (!school_id) throw new Error('school_id is required')
  if (!event_type) throw new Error('event_type is required')

  const status = initialStatus(visit_date)

  const { data, error } = await db()
    .insert({
      user_id,
      school_id,
      school_journey_id: school_journey_id || null,
      event_type,
      visit_date: visit_date || null,
      status,
      prep_notes: prep_notes || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * List visit records for a user + school.
 */
export async function listVisitRecords(params: {
  user_id: string
  school_id: string
}) {
  const { data, error } = await db()
    .select('*')
    .eq('user_id', params.user_id)
    .eq('school_id', params.school_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * List all visit records for a user (cross-school).
 * JOINs schools table to include school_name and school_slug.
 */
export async function listAllVisitRecords(params: { user_id: string }) {
  const { data, error } = await db()
    .select('*, schools(name, slug)')
    .eq('user_id', params.user_id)
    .order('visit_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  // Flatten the joined school data into top-level fields
  return (data || []).map((r: any) => ({
    ...r,
    school_name: r.schools?.name || null,
    school_slug: r.schools?.slug || null,
    schools: undefined,
  }))
}

/**
 * Update a visit record. Ownership enforced by user_id filter.
 */
export async function updateVisitRecord(params: {
  id: string
  user_id: string
  [key: string]: any
}) {
  const { id, user_id, ...fields } = params
  if (!id) throw new Error('id is required')

  const { data, error } = await db()
    .update(fields)
    .eq('id', id)
    .eq('user_id', user_id)
    .select()
    .single()
  if (error) throw error

  // Embed when debrief fields are present
  if (data && (fields.standout_moments || fields.concerns || fields.impression)) {
    embedVisitRecord(data.id, {
      standout_moments: data.standout_moments,
      concerns: data.concerns,
      impression: data.impression,
    })
  }

  return data
}

/**
 * Transition all 'upcoming' visits with visit_date <= today to 'debrief_pending'.
 * Only transitions records that have a visit_date set.
 */
export async function checkAndTransitionVisits(params: { user_id: string }) {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db()
    .update({ status: 'debrief_pending' })
    .eq('user_id', params.user_id)
    .eq('status', 'upcoming')
    .not('visit_date', 'is', null)
    .lte('visit_date', today)
    .select()
  if (error) throw error
  return { transitioned: data?.length || 0, records: data || [] }
}

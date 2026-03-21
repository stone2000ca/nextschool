/**
 * Event reminders — server-side functions
 * Manages user event reminders (migrated from localStorage ns_event_reminders)
 */
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('event_reminders') as any

export async function listEventReminders({ user_id }: { user_id: string }) {
  const { data, error } = await db()
    .select('*')
    .eq('user_id', user_id)
    .order('event_date', { ascending: true })
  if (error) {
    // Gracefully handle missing table (e.g. not yet created in schema)
    if (error.message?.includes('schema cache') || error.code === '42P01' || error.message?.includes('relation') ) {
      console.warn('[eventReminders] Table not found, returning empty array:', error.message)
      return []
    }
    throw error
  }
  return data || []
}

export async function toggleEventReminder({
  user_id,
  event_id,
  school_name,
  event_title,
  event_date,
  conversation_id,
}: {
  user_id: string
  event_id: string
  school_name?: string
  event_title?: string
  event_date?: string
  conversation_id?: string
}) {
  // Check if reminder already exists
  const { data: existing, error: fetchError } = await db()
    .select('id')
    .eq('user_id', user_id)
    .eq('event_id', event_id)
    .maybeSingle()
  if (fetchError) throw fetchError

  if (existing) {
    // Remove reminder
    const { error: deleteError } = await db().delete().eq('id', existing.id)
    if (deleteError) throw deleteError
    return { action: 'removed', event_id }
  } else {
    // Add reminder
    const { data, error: insertError } = await db()
      .insert({ user_id, event_id, school_name, event_title, event_date, conversation_id })
      .select()
      .single()
    if (insertError) throw insertError
    return { action: 'added', reminder: data }
  }
}

export async function cleanExpiredReminders({ user_id }: { user_id: string }) {
  const now = new Date().toISOString()
  const { error } = await db()
    .delete()
    .eq('user_id', user_id)
    .lt('event_date', now)
  if (error) throw error
  return { cleaned: true }
}

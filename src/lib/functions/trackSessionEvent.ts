import { getAdminClient } from '@/lib/supabase/admin'

export async function trackSessionEvent(params: {
  eventType: string
  consultantName?: string
  sessionId: string
  metadata?: Record<string, any>
}) {
  const { eventType, consultantName, sessionId, metadata } = params;

  // Validate required fields
  if (!eventType || !sessionId) {
    throw Object.assign(new Error('Missing required fields'), { statusCode: 400 });
  }

  // Insert directly without .select().single() to avoid PGRST204 error
  // (session_events is fire-and-forget; we don't need the returned row)
  // Note: consultant_name column does not exist in the production session_events table,
  // so we store it inside metadata instead to avoid schema cache errors.
  const supabase = getAdminClient()
  const enrichedMetadata = { ...(metadata || {}), ...(consultantName ? { consultantName } : {}) };
  const { error } = await (supabase.from('session_events') as any).insert({
    event_type: eventType,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    metadata: enrichedMetadata
  })
  if (error) throw error

  return { success: true };
}

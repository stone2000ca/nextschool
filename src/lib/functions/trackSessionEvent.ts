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

  // Use actual DB column names: event_data (not metadata), created_at (not timestamp).
  // consultant_name is stored inside event_data JSONB to avoid PGRST204
  // errors on Supabase Free tier where schema cache reload is unreliable.
  const supabase = getAdminClient()
  const eventData = { ...(metadata || {}), ...(consultantName ? { consultantName } : {}) };
  const { error } = await (supabase.from('session_events') as any).insert({
    event_type: eventType,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    event_data: eventData,
  })
  if (error) throw error

  return { success: true };
}

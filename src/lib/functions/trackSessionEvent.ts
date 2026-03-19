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
  const supabase = getAdminClient()
  const enrichedMetadata = { ...(metadata || {}), ...(consultantName ? { consultantName } : {}) };
  const row: Record<string, any> = {
    event_type: eventType,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    metadata: enrichedMetadata,
  }
  if (consultantName) {
    row.consultant_name = consultantName
  }
  const { error } = await (supabase.from('session_events') as any).insert(row)
  if (error) throw error

  return { success: true };
}

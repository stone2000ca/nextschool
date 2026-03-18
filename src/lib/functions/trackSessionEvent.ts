import { SessionEvent } from '@/lib/entities-server'

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

  // Create session event
  await SessionEvent.create({
    eventType,
    consultantName: consultantName || null,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  });

  return { success: true };
}

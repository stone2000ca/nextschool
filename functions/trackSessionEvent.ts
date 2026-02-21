import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventType, consultantName, sessionId, metadata } = await req.json();

    // Validate required fields
    if (!eventType || !sessionId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create session event
    await base44.asServiceRole.entities.SessionEvent.create({
      eventType,
      consultantName: consultantName || null,
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to track session event:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
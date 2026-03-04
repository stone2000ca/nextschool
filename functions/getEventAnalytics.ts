// Function: getEventAnalytics
// Purpose: Retrieve aggregated analytics (views, register clicks, tour requests) for school events
// Entities: SessionEvent, SchoolInquiry
// Last Modified: 2026-03-04
// Dependencies: Base44 SDK

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { schoolId, eventIds } = payload;

    if (!schoolId || !Array.isArray(eventIds) || eventIds.length === 0) {
      return Response.json(
        { error: 'Missing or invalid schoolId or eventIds' },
        { status: 400 }
      );
    }

    // Initialize result map
    const analytics = {};
    for (const eventId of eventIds) {
      analytics[eventId] = { views: 0, register_clicks: 0, tour_requests: 0 };
    }

    // Query SessionEvent for event_view and event_register_click
    const sessionEvents = await base44.asServiceRole.entities.SessionEvent.filter({
      metadata: { $exists: true }
    });

    for (const event of sessionEvents) {
      const metadata = event.metadata || {};
      
      // Count event_view events
      if (event.eventType === 'event_view' && metadata.eventId && eventIds.includes(metadata.eventId)) {
        if (!analytics[metadata.eventId]) {
          analytics[metadata.eventId] = { views: 0, register_clicks: 0, tour_requests: 0 };
        }
        analytics[metadata.eventId].views += 1;
      }

      // Count event_register_click events
      if (event.eventType === 'event_register_click' && metadata.eventId && eventIds.includes(metadata.eventId)) {
        if (!analytics[metadata.eventId]) {
          analytics[metadata.eventId] = { views: 0, register_clicks: 0, tour_requests: 0 };
        }
        analytics[metadata.eventId].register_clicks += 1;
      }
    }

    // Query SchoolInquiry for tour_request counts
    const inquiries = await base44.asServiceRole.entities.SchoolInquiry.filter({
      schoolId,
      inquiryType: 'tour_request'
    });

    // Count tour requests per eventId (if available)
    for (const inquiry of inquiries) {
      if (inquiry.eventId && eventIds.includes(inquiry.eventId)) {
        analytics[inquiry.eventId].tour_requests += 1;
      }
    }

    // Also count total tour requests for the school (for events without explicit eventId)
    const totalTourRequests = inquiries.length;
    
    return Response.json({
      analytics,
      totalTourRequests
    });
  } catch (error) {
    console.error('Error in getEventAnalytics:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
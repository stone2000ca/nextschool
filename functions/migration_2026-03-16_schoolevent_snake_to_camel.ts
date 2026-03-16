// MIGRATION — DELETE AFTER RUNNING
// Purpose: Migrate SchoolEvent records from snake_case field names to camelCase
// Entities: SchoolEvent
// Last Modified: 2026-03-16

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[MIGRATION] Fetching all SchoolEvent records...');
    const allEvents = await base44.asServiceRole.entities.SchoolEvent.filter({});
    console.log(`[MIGRATION] Found ${allEvents.length} records to migrate`);

    const fieldMapping = {
      event_type: 'eventType',
      school_id: 'schoolId',
      is_active: 'isActive',
      is_confirmed: 'isConfirmed',
      is_recurring: 'isRecurring',
      end_date: 'endDate',
      registration_url: 'registrationUrl',
      virtual_url: 'virtualUrl',
      recurrence_rule: 'recurrenceRule'
    };

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < allEvents.length; i++) {
      const record = allEvents[i];
      const updateData = {};

      // Copy each old snake_case field to new camelCase field
      Object.entries(fieldMapping).forEach(([oldKey, newKey]) => {
        if (oldKey in record && record[oldKey] !== undefined && record[oldKey] !== null) {
          updateData[newKey] = record[oldKey];
        }
        // Also null out the old field
        updateData[oldKey] = null;
      });

      try {
        await base44.asServiceRole.entities.SchoolEvent.update(record.id, updateData);
        successCount++;
        if ((i + 1) % 50 === 0) {
          console.log(`[MIGRATION] Progress: ${i + 1}/${allEvents.length}`);
        }
      } catch (err) {
        errorCount++;
        errors.push({ id: record.id, error: err.message });
        console.error(`[MIGRATION] Failed to update ${record.id}:`, err.message);
      }
    }

    console.log(`[MIGRATION] Complete: ${successCount} successful, ${errorCount} failed`);

    return Response.json({
      success: errorCount === 0,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
      message: `Migration completed. ${successCount} records updated, ${errorCount} failed.`
    });
  } catch (error) {
    console.error('[MIGRATION] Fatal error:', error);
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});
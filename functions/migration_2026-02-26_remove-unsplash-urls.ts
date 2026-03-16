// MIGRATION — DELETE AFTER RUNNING — Purpose: Remove unsplash URLs from header_photo_url field in School entity
// Function: migration_2026-02-26_remove-unsplash-urls
// Entities: School
// Last Modified: 2026-02-26
// Dependencies: None

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all schools
    const schools = await base44.asServiceRole.entities.School.filter({}, null, 1000);
    console.log(`[MIGRATION] Found ${schools.length} schools`);
    
    let updated = 0;
    let skipped = 0;
    const failures = [];
    
    for (const school of schools) {
      if (school.header_photo_url && school.header_photo_url.includes('unsplash')) {
        try {
          await base44.asServiceRole.entities.School.update(school.id, {
            header_photo_url: null
          });
          updated++;
          console.log(`[MIGRATION] Cleared header_photo_url for: ${school.name}`);
        } catch (error) {
          failures.push({ schoolId: school.id, schoolName: school.name, error: error.message });
          console.error(`[MIGRATION] Failed to update ${school.name}:`, error.message);
        }
      } else {
        skipped++;
      }
    }
    
    return Response.json({
      status: 'complete',
      totalProcessed: schools.length,
      updated,
      skipped,
      failures,
      message: `Migration complete: Updated ${updated} schools, skipped ${skipped}`
    });
  } catch (error) {
    console.error('[MIGRATION] Fatal error:', error.message);
    return Response.json({ 
      status: 'error',
      error: error.message 
    }, { status: 500 });
  }
});
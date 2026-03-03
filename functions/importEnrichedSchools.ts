// Function: importEnrichedSchools
// Purpose: Import enriched school data from CSV file into School entity
// Entities: School
// Last Modified: 2026-03-03
// Dependencies: Papa Parse (CSV parsing)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Papa from 'npm:papaparse';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { fileUrl } = await req.json();
    if (!fileUrl) {
      return Response.json({ error: 'fileUrl required' }, { status: 400 });
    }

    // Fetch CSV
    const csvRes = await fetch(fileUrl);
    if (!csvRes.ok) {
      return Response.json({ error: 'Failed to fetch CSV' }, { status: 400 });
    }
    
    const csvText = await csvRes.text();
    
    // Parse CSV
    const parsed = Papa.parse(csvText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true
    });
    
    if (parsed.errors.length > 0) {
      return Response.json({ error: 'CSV parse error', details: parsed.errors }, { status: 400 });
    }

    const rows = parsed.data || [];
    console.log(`Importing ${rows.length} schools from CSV`);

    let created = 0;
    let updated = 0;
    let errors = [];

    // Process each row
    for (const row of rows) {
      try {
        if (!row.name || !row.slug) {
          errors.push({ row: rows.indexOf(row), error: 'Missing name or slug' });
          continue;
        }

        // Check if school exists by slug
        const existing = await base44.entities.School.filter({ slug: row.slug });

        if (existing.length > 0) {
          // Update existing
          await base44.entities.School.update(existing[0].id, row);
          updated++;
        } else {
          // Create new
          await base44.entities.School.create(row);
          created++;
        }

        // Throttle requests
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (e) {
        errors.push({ row: rows.indexOf(row), error: e.message });
      }
    }

    return Response.json({
      success: true,
      created,
      updated,
      total: rows.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
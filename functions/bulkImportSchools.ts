// Function: bulkImportSchools
// Purpose: Import and upsert schools from CSV file by slug matching
// Entities: School
// Last Modified: 2026-03-03
// Dependencies: PapaParse for CSV parsing

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

    // Fetch and parse CSV
    const csvRes = await fetch(fileUrl);
    if (!csvRes.ok) throw new Error('Failed to fetch CSV');
    
    const csvText = await csvRes.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      return Response.json({ error: 'CSV parse failed', details: parsed.errors }, { status: 400 });
    }

    const rows = parsed.data || [];
    let created = 0, updated = 0;
    const errors = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.slug) {
          errors.push({ slug: row.slug, error: 'Missing name or slug' });
          continue;
        }

        const existing = await base44.entities.School.filter({ slug: row.slug });
        if (existing.length > 0) {
          await base44.entities.School.update(existing[0].id, row);
          updated++;
        } else {
          await base44.entities.School.create(row);
          created++;
        }

        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        errors.push({ slug: row.slug, error: err.message });
      }
    }

    return Response.json({ success: true, created, updated, total: rows.length, errors: errors.length ? errors : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
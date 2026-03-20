// Function: bulkImportSchools
// Purpose: Import and upsert schools from CSV file by slug matching
// Entities: School
// Last Modified: 2026-03-03

import { School } from '@/lib/entities-server'
import { embedSchool } from '@/lib/ai/embedHooks'
import Papa from 'papaparse'

export async function bulkImportSchoolsLogic(params: { fileUrl: string }) {
  const { fileUrl } = params;
  if (!fileUrl) throw Object.assign(new Error('fileUrl required'), { status: 400 });

  const csvRes = await fetch(fileUrl);
  if (!csvRes.ok) throw new Error('Failed to fetch CSV');

  const csvText = await csvRes.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    throw Object.assign(new Error('CSV parse failed'), { status: 400, details: parsed.errors });
  }

  const rows = parsed.data || [];
  let created = 0, updated = 0;
  const errors: any[] = [];

  for (const row of rows as any[]) {
    try {
      if (!row.name || !row.slug) { errors.push({ slug: row.slug, error: 'Missing name or slug' }); continue; }
      const existing = await School.filter({ slug: row.slug });
      if (existing.length > 0) { await School.update(existing[0].id, row); updated++; embedSchool(existing[0].id, row); }
      else { const newSchool = await School.create(row); created++; embedSchool(newSchool.id, row); }
      await new Promise(r => setTimeout(r, 50));
    } catch (err: any) { errors.push({ slug: row.slug, error: err.message }); }
  }

  return { success: true, created, updated, total: rows.length, errors: errors.length ? errors : null };
}

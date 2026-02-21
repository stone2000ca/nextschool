import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const generateSlug = (schoolName) => {
  return schoolName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { schools, importBatchId, region, country } = await req.json();

    if (!Array.isArray(schools) || schools.length === 0) {
      return Response.json({ error: 'Invalid input: schools array required' }, { status: 400 });
    }

    if (!importBatchId) {
      return Response.json({ error: 'Invalid input: importBatchId required' }, { status: 400 });
    }

    // Add default values and generate slugs
    const enrichedSchools = schools.map(school => ({
      ...school,
      slug: school.slug || generateSlug(school.name),
      region: region || school.region || 'Canada',
      country: country || school.country || 'Canada',
      currency: school.currency || 'CAD',
      dataSource: school.dataSource || 'manual',
      gradeSystem: school.gradeSystem || 'north_american',
      status: school.status || 'active',
      importBatchId
    }));

    // Call importSchoolBatch
    const importResult = await base44.asServiceRole.functions.invoke('importSchoolBatch', {
      schools: enrichedSchools,
      importBatchId
    });

    return Response.json({
      success: true,
      totalProcessed: enrichedSchools.length,
      importResult: importResult.summary || importResult
    });
  } catch (error) {
    console.error('Error importing schools:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all schools in batches
    let allSchools = [];
    let pageSize = 500;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const schools = await base44.asServiceRole.entities.School.list(undefined, pageSize, offset);
      if (!schools || schools.length === 0) {
        hasMore = false;
      } else {
        allSchools = allSchools.concat(schools);
        offset += pageSize;
        hasMore = schools.length === pageSize;
      }
    }

    // Convert to JSON string
    const jsonData = JSON.stringify(allSchools, null, 2);
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonData);

    // Return as downloadable JSON file
    return new Response(jsonBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="schools_export_${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Length': jsonBytes.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all schools
    const allSchools = await base44.asServiceRole.entities.School.list('-updated_date', 1000);
    
    // Check for missing headerPhotoUrl
    const missingPhotos = allSchools.filter(s => !s.headerPhotoUrl);
    
    // Deduplicate by name + address (exact match)
    const seenKeys = new Set();
    const duplicates = [];
    const toDelete = [];
    
    for (const school of allSchools) {
      const key = `${school.name}|${school.address}`.toLowerCase().trim();
      
      if (seenKeys.has(key)) {
        duplicates.push({
          name: school.name,
          address: school.address,
          id: school.id
        });
        // Mark older duplicate for deletion (keep first occurrence)
        toDelete.push(school.id);
      } else {
        seenKeys.add(key);
      }
    }
    
    // Delete duplicates
    let deletedCount = 0;
    for (const schoolId of toDelete) {
      try {
        await base44.asServiceRole.entities.School.delete(schoolId);
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete ${schoolId}:`, e);
      }
    }
    
    return Response.json({
      totalSchools: allSchools.length,
      missingPhotos: missingPhotos.length,
      missingPhotoList: missingPhotos.map(s => s.name),
      duplicatesFound: duplicates.length,
      duplicatesList: duplicates,
      deleted: deletedCount,
      finalCount: allSchools.length - deletedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
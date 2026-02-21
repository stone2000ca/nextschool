import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all schools with descriptions
    const allSchools = await base44.asServiceRole.entities.School.list(null, 5000);
    
    if (!allSchools || allSchools.length === 0) {
      return Response.json({ error: 'No schools found' }, { status: 400 });
    }

    // Function to clean description text
    const cleanDescription = (description) => {
      if (!description || typeof description !== 'string') return description;
      
      // Remove markdown links: [text](url)
      let cleaned = description.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
      
      // Remove inline URLs: http://... or https://...
      cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, '');
      
      // Remove citation patterns like "([source.com](url))" or "(source)"
      cleaned = cleaned.replace(/\(\s*\[?[^\]]*\]?\s*\)/g, '');
      
      // Remove trailing whitespace and extra spaces
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    };

    // Find schools with descriptions containing citations/URLs
    const schoolsToClean = allSchools.filter(school => {
      if (!school.description) return false;
      return /\[.+\]\(.+\)|https?:\/\/|\(.*\.com.*\)/.test(school.description);
    });

    if (schoolsToClean.length === 0) {
      return Response.json({
        success: true,
        message: 'No school descriptions need cleaning'
      });
    }

    const cleanupResults = [];
    let totalCleaned = 0;

    console.log(`[CLEANUP] Found ${schoolsToClean.length} schools with descriptions needing cleanup`);

    for (const school of schoolsToClean) {
      try {
        const originalDescription = school.description;
        const cleanedDescription = cleanDescription(originalDescription);

        if (originalDescription !== cleanedDescription) {
          await base44.asServiceRole.entities.School.update(school.id, {
            description: cleanedDescription
          });
          totalCleaned++;

          cleanupResults.push({
            schoolName: school.name,
            city: school.city,
            success: true,
            originalLength: originalDescription.length,
            cleanedLength: cleanedDescription.length
          });

          console.log(`[CLEANUP] Cleaned ${school.name}`);
        }
      } catch (error) {
        cleanupResults.push({
          schoolName: school.name,
          success: false,
          error: error.message
        });
        console.error(`[CLEANUP] Failed ${school.name}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      totalCleaned,
      results: cleanupResults
    });

  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
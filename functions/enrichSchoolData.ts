import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { country = 'United Kingdom', limit = 5 } = await req.json();

    console.log(`Starting data enrichment for ${country}...`);

    // Fetch schools for the specified country
    const schools = await base44.asServiceRole.entities.School.filter(
      { country, status: 'active' },
      '-created_date',
      limit
    );

    console.log(`Found ${schools.length} schools in ${country}`);

    const enrichedCount = { success: 0, failed: 0 };
    const results = [];

    for (const school of schools) {
      try {
        console.log(`Enriching: ${school.name}...`);

        // Search for school website
        const searchResults = await fetch('https://api.bing.com/v7.0/search', {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': Deno.env.get('BING_SEARCH_KEY') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: `${school.name} private school ${school.city} official website`
          })
        }).then(r => r.json()).catch(() => ({ webPages: [] }));

        const websiteUrl = searchResults.webPages?.[0]?.url || school.website || '';
        
        // If no website found, try basic search
        let enrichedData = {
          website: websiteUrl,
          logoUrl: school.logoUrl,
          headerPhotoUrl: school.headerPhotoUrl,
          highlights: school.highlights || []
        };

        // Use LLM to generate highlights based on school info
        if (!enrichedData.highlights || enrichedData.highlights.length === 0) {
          try {
            const highlightsResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Generate 3 short, compelling selling points (max 15 words each) for this school based on its details. Format as JSON array of strings.
              
School: ${school.name}
Location: ${school.city}, ${school.country}
Curriculum: ${school.curriculumType}
Specializations: ${school.specializations?.join(', ') || 'N/A'}
Founded: ${school.founded}
Student-Teacher Ratio: ${school.studentTeacherRatio}
Class Size: ${school.avgClassSize}

Return ONLY a valid JSON array like ["highlight 1", "highlight 2", "highlight 3"]`,
              response_json_schema: {
                type: 'object',
                properties: {
                  highlights: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              }
            });

            enrichedData.highlights = highlightsResult.highlights || [];
          } catch (e) {
            console.warn(`Failed to generate highlights for ${school.name}:`, e.message);
          }
        }

        // Update school with enriched data
        await base44.asServiceRole.entities.School.update(school.id, {
          website: enrichedData.website,
          highlights: enrichedData.highlights
        });

        enrichedCount.success++;
        results.push({ name: school.name, status: 'success' });
      } catch (error) {
        enrichedCount.failed++;
        results.push({ name: school.name, status: 'failed', error: error.message });
        console.error(`Failed to enrich ${school.name}:`, error.message);
      }
    }

    return Response.json({
      country,
      processed: schools.length,
      success: enrichedCount.success,
      failed: enrichedCount.failed,
      results
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
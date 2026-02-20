import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { schoolIds } = await req.json();

    // Fetch schools to update
    let schools = [];
    if (schoolIds && schoolIds.length > 0) {
      // Fetch specific schools
      schools = await Promise.all(
        schoolIds.map(id => base44.asServiceRole.entities.School.get(id))
      );
    } else {
      // Fetch all schools without headerPhotoUrl
      schools = await base44.asServiceRole.entities.School.filter({});
      schools = schools.filter(s => !s.headerPhotoUrl);
    }

    const updated = [];
    
    for (const school of schools) {
      let headerPhotoUrl = null;

      // Step 1: Try to construct website URL and fetch og:image
      let websiteUrl = school.website;
      if (!websiteUrl) {
        // Try to construct URL from school name
        const slug = school.slug || school.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const possibleDomains = [
          `https://www.${slug}.com`,
          `https://www.${slug}.ca`,
          `https://www.${slug}.org`,
          `https://www.${slug}.co.uk`,
          `https://www.${slug}.edu`,
          `https://${slug}.com`,
          `https://${slug}.ca`,
          `https://${slug}.org`,
        ];
        
        // Try each domain
        for (const domain of possibleDomains) {
          try {
            const response = await fetch(domain, { 
              headers: { 'User-Agent': 'Mozilla/5.0' },
              redirect: 'follow'
            });
            if (response.ok) {
              const html = await response.text();
              
              // Extract og:image meta tag
              const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
              if (ogImageMatch && ogImageMatch[1]) {
                headerPhotoUrl = ogImageMatch[1];
                websiteUrl = domain;
                break;
              }
            }
          } catch (e) {
            // Continue to next domain
          }
        }
      } else {
        // Use provided website URL
        try {
          const response = await fetch(websiteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
          });
          if (response.ok) {
            const html = await response.text();
            const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
            if (ogImageMatch && ogImageMatch[1]) {
              headerPhotoUrl = ogImageMatch[1];
            }
          }
        } catch (e) {
          // Fall through to AI generation
        }
      }

      // Step 2: If no og:image found, use AI to generate image
      if (!headerPhotoUrl) {
        try {
          const prompt = `Generate a professional photo of ${school.name} school campus. ` +
            `Location: ${school.city}, ${school.provinceState || school.country}. ` +
            `School type: ${school.schoolType}. Show the school building exterior, campus grounds, ` +
            `or students learning. Make it look like a real school photo suitable for a website header.`;
          
          const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt
          });
          
          if (imageResult.url) {
            headerPhotoUrl = imageResult.url;
          }
        } catch (e) {
          console.error(`Failed to generate image for ${school.name}:`, e);
        }
      }

      // Step 3: Update school if we have a photo URL
      if (headerPhotoUrl) {
        try {
          await base44.asServiceRole.entities.School.update(school.id, {
            headerPhotoUrl,
            website: websiteUrl || school.website
          });
          
          updated.push({
            id: school.id,
            name: school.name,
            source: headerPhotoUrl.includes('openai') ? 'generated' : 'og:image',
            url: headerPhotoUrl
          });
        } catch (e) {
          console.error(`Failed to update ${school.name}:`, e);
        }
      }
    }

    return Response.json({ 
      success: true,
      updated: updated.length,
      schools: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
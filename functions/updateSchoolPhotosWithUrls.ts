import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function tryFetchOgImage(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const html = await response.text();
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImageMatch && ogImageMatch[1]) {
        return ogImageMatch[1];
      }
    }
  } catch (e) {
    // Timeout or error
  }
  return null;
}

function getClearbitUrl(websiteUrl) {
  try {
    const domain = new URL(websiteUrl).hostname;
    return `https://logo.clearbit.com/${domain}`;
  } catch (e) {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { schools } = await req.json();

    const updated = [];
    
    for (const schoolData of schools) {
      let headerPhotoUrl = null;
      const { schoolId, website } = schoolData;

      // Try to fetch og:image from provided website
      if (website) {
        headerPhotoUrl = await tryFetchOgImage(website);
      }

      // Fallback to Clearbit if og:image not found
      if (!headerPhotoUrl && website) {
        const clearbitUrl = getClearbitUrl(website);
        if (clearbitUrl) {
          try {
            const response = await fetch(clearbitUrl, { redirect: 'follow' });
            if (response.ok && response.status === 200) {
              headerPhotoUrl = clearbitUrl;
            }
          } catch (e) {
            console.error(`Clearbit fetch failed for ${website}`);
          }
        }
      }

      // Update school
      if (headerPhotoUrl) {
        try {
          await base44.asServiceRole.entities.School.update(schoolId, {
            headerPhotoUrl,
            website
          });
          
          updated.push({
            schoolId,
            website,
            source: headerPhotoUrl.includes('clearbit') ? 'clearbit' : 'og:image'
          });
        } catch (e) {
          console.error(`Update failed for ${schoolId}:`, e);
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
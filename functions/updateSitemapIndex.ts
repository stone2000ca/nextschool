import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Called automatically when schools or blog posts are created/updated
 * Invalidates sitemap cache so it regenerates on next request
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function doesn't need to do anything complex
    // The generateSitemap function will check updated_date on schools and blogs
    // and regenerate based on that
    
    return Response.json({ 
      success: true, 
      message: 'Sitemap will be regenerated on next request' 
    });
  } catch (error) {
    console.error('Sitemap update failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
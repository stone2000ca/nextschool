// Function: robotsTxt
// Purpose: Serve robots.txt with Allow directive and Sitemap reference
// Entities: None
// Last Modified: 2026-02-28
// Dependencies: None

Deno.serve(async (req) => {
  const content = `User-agent: *
Allow: /

Sitemap: https://nextschool.ca/sitemap.xml
`;

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
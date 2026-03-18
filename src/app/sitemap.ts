import { createClient } from '@/lib/supabase/server'

export default async function sitemap() {
  const supabase = await createClient()
  const { data: schools } = await supabase.from('schools').select('slug, updated_date').eq('status', 'active')
  const { data: posts } = await supabase.from('blog_posts').select('slug, updated_date').eq('is_published', true)

  return [
    { url: 'https://nextschool.ca', lastModified: new Date() },
    { url: 'https://nextschool.ca/schools', lastModified: new Date() },
    { url: 'https://nextschool.ca/about', lastModified: new Date() },
    { url: 'https://nextschool.ca/guides', lastModified: new Date() },
    { url: 'https://nextschool.ca/pricing', lastModified: new Date() },
    { url: 'https://nextschool.ca/how-it-works', lastModified: new Date() },
    ...(schools || []).map((s) => ({
      url: `https://nextschool.ca/school/${s.slug}`,
      lastModified: s.updated_date,
    })),
    ...(posts || []).map((p) => ({
      url: `https://nextschool.ca/blog/${p.slug}`,
      lastModified: p.updated_date,
    })),
  ]
}

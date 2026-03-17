// Function: updateSchoolPhotos
// Purpose: For each school with a website but no headerPhotoUrl, find the best photo
//          from PhotoCandidate (or scrape if none exist) and write it to School.headerPhotoUrl
// Entities: School (read + write), PhotoCandidate (read + write)
// Last Modified: 2026-03-17
// Dependencies: Base44 SDK, school website (external HTTP fetch during scrape)

import { createClientFromRequest } from 'npm:@base44/sdk';

// ─── Scraping helpers ─────────────────────────────────────────────────────────

const CRAWL_PATHS = [
  '',
  '/about',
  '/gallery',
  '/photos',
  '/campus',
  '/our-school',
  '/admissions',
  '/campus-life',
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SKIP_EXTENSIONS = /\.(svg|gif|ico)(\?|$)/i;
const SKIP_PATTERNS =
  /\/(icon|logo|favicon|sprite|pixel|tracking|analytics|1x1|2x2)\b/i;
const DATA_URI = /^data:/i;

function inferType(imageUrl: string, altText: string, pageUrl: string) {
  const combined = `${imageUrl} ${altText} ${pageUrl}`.toLowerCase();
  if (/hero|banner|header|landing|home|main[-_]image/.test(combined)) return 'hero';
  if (/classroom|learning|teaching|lesson|students[-_]in[-_]class/.test(combined)) {
    return 'classroom';
  }
  if (/sport|gym|field|court|pool|athlete|soccer|hockey|basketball|tennis|track/.test(combined)) {
    return 'sports';
  }
  if (/campus|building|facility|exterior|grounds|aerial|architecture/.test(combined)) {
    return 'campus';
  }
  return 'general';
}

function resolveUrl(src: string, base: string) {
  try {
    if (DATA_URI.test(src)) return null;
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function normaliseBase(url: string) {
  let u = url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

async function fetchPage(url: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function getFileSize(url: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': BROWSER_UA },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

type RawImg = {
  imageUrl: string;
  altText: string;
  widthAttr: number | null;
  heightAttr: number | null;
  pageUrl: string;
};

function extractImages(html: string, pageUrl: string, base: string): RawImg[] {
  const results: RawImg[] = [];

  // og:image first
  const ogMatch =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );
  if (ogMatch) {
    const resolved = resolveUrl(ogMatch[1], base);
    if (resolved) {
      results.push({
        imageUrl: resolved,
        altText: 'og:image',
        widthAttr: null,
        heightAttr: null,
        pageUrl,
      });
    }
  }

  // <img> tags
  const imgRegex = /<img\b([^>]*?)(?:\/>|>)/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[1];
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const resolved = resolveUrl(srcMatch[1].trim(), base);
    if (!resolved) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const widthMatch = tag.match(/\bwidth=["']?(\d+)["']?/i);
    const heightMatch = tag.match(/\bheight=["']?(\d+)["']?/i);
    results.push({
      imageUrl: resolved,
      altText: altMatch ? altMatch[1].trim() : '',
      widthAttr: widthMatch ? parseInt(widthMatch[1], 10) : null,
      heightAttr: heightMatch ? parseInt(heightMatch[1], 10) : null,
      pageUrl,
    });
  }

  return results;
}

function shouldSkip(candidate: RawImg) {
  const url = candidate.imageUrl;
  if (DATA_URI.test(url)) return true;
  if (SKIP_EXTENSIONS.test(url)) return true;
  if (SKIP_PATTERNS.test(url)) return true;
  if (/[?&](w=1|h=1|width=1|height=1)/.test(url)) return true;
  if (candidate.widthAttr !== null && candidate.widthAttr < 400) return true;
  if (candidate.heightAttr !== null && candidate.heightAttr < 300) return true;
  if (/[_\-/](1x1|2x2|pixel)[_\-./]/.test(url)) return true;
  return false;
}

// Scrape a school's website and write PhotoCandidate records; returns the created records
async function scrapeAndStoreCandidates(base44: any, school: any) {
  const base = normaliseBase(school.website);
  const batchId = `${school.id}_${Date.now()}`;
  const seen = new Set<string>();
  const allCandidates: RawImg[] = [];

  for (const path of CRAWL_PATHS) {
    const pageUrl = `${base}${path}`;
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    for (const img of extractImages(html, pageUrl, base)) {
      if (!seen.has(img.imageUrl)) {
        seen.add(img.imageUrl);
        allCandidates.push(img);
      }
    }
    // brief politeness delay
    await new Promise((r) => setTimeout(r, 500));
  }

  const now = new Date().toISOString();
  const records: any[] = [];

  for (const candidate of allCandidates) {
    if (shouldSkip(candidate)) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(candidate.imageUrl)) continue;

    const fileSize = await getFileSize(candidate.imageUrl);
    if (fileSize !== null && fileSize < 20480) continue;

    records.push({
      schoolId: school.id,
      schoolName: school.name,
      imageUrl: candidate.imageUrl,
      pageUrl: candidate.pageUrl,
      source: 'website',
      altText: candidate.altText || '',
      inferredType: inferType(
        candidate.imageUrl,
        candidate.altText || '',
        candidate.pageUrl,
      ),
      widthAttr: candidate.widthAttr,
      heightAttr: candidate.heightAttr,
      fileSizeBytes: fileSize,
      status: 'pending',
      batchId,
      createdDate: now,
    });
  }

  const CHUNK = 20;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    if (slice.length > 0) {
      await base44.asServiceRole.entities.PhotoCandidate.bulkCreate(slice);
    }
  }

  console.log(`[SCRAPE] ${school.name}: ${records.length} candidates stored`);
  return records;
}

// Pick the best candidate: hero > campus > largest file size
function pickBest(candidates: any[]) {
  if (!candidates || candidates.length === 0) return null;
  const hero = candidates.find((c) => c.inferredType === 'hero');
  if (hero) return hero;
  const campus = candidates.find((c) => c.inferredType === 'campus');
  if (campus) return campus;
  return candidates.sort(
    (a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0),
  )[0];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as any));
    const { schoolIds } = body as { schoolIds?: string[] };

    // Load target schools: specific IDs or all schools missing headerPhotoUrl with a website
    let schools: any[] = [];
    if (schoolIds && schoolIds.length > 0) {
      const fetched = await Promise.all(
        schoolIds.map((id) => base44.asServiceRole.entities.School.get(id)),
      );
      schools = fetched.filter(
        (s) => s && s.website && !s.headerPhotoUrl && s.status === 'active',
      );
    } else {
      const all = await base44.asServiceRole.entities.School.filter({
        status: 'active',
      });
      schools = all.filter((s: any) => s.website && !s.headerPhotoUrl);
    }

    console.log(`[UPDATE PHOTOS] Processing ${schools.length} schools`);

    const results = {
      updated: [] as any[],
      skipped: [] as any[],
      errors: [] as any[],
    };

    for (const school of schools) {
      try {
        // Step 1: Check existing PhotoCandidates
        let candidates =
          await base44.asServiceRole.entities.PhotoCandidate.filter({
            schoolId: school.id,
          });

        // Step 2: If none, scrape now
        if (!candidates || candidates.length === 0) {
          console.log(
            `[UPDATE PHOTOS] No candidates for ${school.name} — scraping...`,
          );
          candidates = await scrapeAndStoreCandidates(base44, school);
        }

        // Step 3: Pick best candidate
        const best = pickBest(candidates);
        if (!best) {
          console.log(
            `[UPDATE PHOTOS] No usable photo found for ${school.name} — skipping`,
          );
          results.skipped.push({ name: school.name, reason: 'no_candidates' });
          continue;
        }

        // Step 4: Write to School
        await base44.asServiceRole.entities.School.update(school.id, {
          headerPhotoUrl: best.imageUrl,
        });

        console.log(
          `[UPDATE PHOTOS] ✓ ${school.name} → ${best.inferredType} (${best.imageUrl})`,
        );
        results.updated.push({
          name: school.name,
          type: best.inferredType,
          url: best.imageUrl,
        });
      } catch (err: any) {
        console.error(
          `[UPDATE PHOTOS] Error on ${school.name}:`,
          err?.message || err,
        );
        results.errors.push({
          name: school.name,
          error: err?.message || String(err),
        });
      }
    }

    return Response.json({
      success: true,
      processed: schools.length,
      updated: results.updated.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      details: results,
    });
  } catch (error: any) {
    console.error('[UPDATE PHOTOS] Fatal:', error?.message || error);
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
});

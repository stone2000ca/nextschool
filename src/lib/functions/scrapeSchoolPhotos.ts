// Function: scrapeSchoolPhotos
// Purpose: Crawl school website, extract image candidates, store PhotoCandidate records
// Entities: School (read), PhotoCandidate (write)
// Last Modified: 2026-03-05

import { School, PhotoCandidate } from '@/lib/entities-server'

const CRAWL_PATHS = ['', '/about', '/gallery', '/photos', '/campus', '/our-school', '/admissions', '/campus-life'];
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SKIP_EXTENSIONS = /\.(svg|gif|ico)(\?|$)/i;
const SKIP_PATTERNS = /\/(icon|logo|favicon|sprite|pixel|tracking|analytics|1x1|2x2)\b/i;
const DATA_URI = /^data:/i;

function inferType(imageUrl: string, altText: string, pageUrl: string): string {
  const combined = `${imageUrl} ${altText} ${pageUrl}`.toLowerCase();
  if (/hero|banner|header|landing|home|main[-_]image/.test(combined)) return 'hero';
  if (/classroom|learning|teaching|lesson/.test(combined)) return 'classroom';
  if (/sport|gym|field|court|pool|athlete/.test(combined)) return 'sports';
  if (/campus|building|facility|exterior/.test(combined)) return 'campus';
  return 'general';
}

function resolveUrl(src: string, base: string): string | null {
  try { if (DATA_URI.test(src)) return null; return new URL(src, base).href; } catch { return null; }
}

function normaliseBase(url: string): string {
  let u = url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function getFileSize(url: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': BROWSER_UA }, signal: controller.signal });
    clearTimeout(timer);
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch { return null; }
}

function extractImages(html: string, pageUrl: string, base: string): any[] {
  const results: any[] = [];
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) { const resolved = resolveUrl(ogMatch[1], base); if (resolved) results.push({ imageUrl: resolved, altText: 'og:image', widthAttr: null, heightAttr: null, pageUrl }); }

  const imgRegex = /<img\b([^>]*?)(?:\/>|>)/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[1];
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const resolved = resolveUrl(srcMatch[1].trim(), base);
    if (!resolved) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const widthMatch = tag.match(/\bwidth=["']?(\d+)["']?/i);
    const heightMatch = tag.match(/\bheight=["']?(\d+)["']?/i);
    results.push({ imageUrl: resolved, altText: altMatch ? altMatch[1].trim() : '', widthAttr: widthMatch ? parseInt(widthMatch[1], 10) : null, heightAttr: heightMatch ? parseInt(heightMatch[1], 10) : null, pageUrl });
  }
  return results;
}

function shouldSkip(candidate: any): boolean {
  const url = candidate.imageUrl;
  if (DATA_URI.test(url) || SKIP_EXTENSIONS.test(url) || SKIP_PATTERNS.test(url)) return true;
  if (/[?&](w=1|h=1|width=1|height=1)/.test(url)) return true;
  if (candidate.widthAttr !== null && candidate.widthAttr < 400) return true;
  if (candidate.heightAttr !== null && candidate.heightAttr < 300) return true;
  return false;
}

export async function scrapeSchoolPhotosLogic(params: { schoolId: string; websiteUrl?: string }) {
  const { schoolId, websiteUrl: inputWebsiteUrl } = params;
  if (!schoolId) throw Object.assign(new Error('schoolId is required'), { status: 400 });

  const schools = await School.filter({ id: schoolId });
  if (!schools?.length) throw Object.assign(new Error('School not found'), { status: 404 });
  const school = schools[0];

  const rawBase = inputWebsiteUrl || school.website;
  if (!rawBase) throw Object.assign(new Error('No website URL available'), { status: 400 });

  const base = normaliseBase(rawBase);
  const batchId = `${schoolId}_${Date.now()}`;
  const seen = new Set<string>();
  const allCandidates: any[] = [];

  for (const path of CRAWL_PATHS) {
    const pageUrl = `${base}${path}`;
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    for (const img of extractImages(html, pageUrl, base)) { if (!seen.has(img.imageUrl)) { seen.add(img.imageUrl); allCandidates.push(img); } }
    await new Promise(r => setTimeout(r, 500));
  }

  const now = new Date().toISOString();
  const records: any[] = [];
  for (const candidate of allCandidates) {
    if (shouldSkip(candidate)) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(candidate.imageUrl)) continue;
    const fileSize = await getFileSize(candidate.imageUrl);
    if (fileSize !== null && fileSize < 20480) continue;
    records.push({ schoolId, schoolName: school.name, imageUrl: candidate.imageUrl, pageUrl: candidate.pageUrl, source: 'website', altText: candidate.altText || '', inferredType: inferType(candidate.imageUrl, candidate.altText || '', candidate.pageUrl), widthAttr: candidate.widthAttr, heightAttr: candidate.heightAttr, fileSizeBytes: fileSize, status: 'pending', batchId, createdDate: now });
  }

  const CHUNK = 20;
  for (let i = 0; i < records.length; i += CHUNK) {
    await PhotoCandidate.bulkCreate(records.slice(i, i + CHUNK));
  }

  return { success: true, batchId, candidatesCreated: records.length, schoolName: school.name };
}

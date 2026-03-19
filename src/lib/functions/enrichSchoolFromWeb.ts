// Function: enrichSchoolFromWeb
// Purpose: Scrape a school's website, extract structured data via LLM, and create EnrichmentDiff records
// Entities: School (read), EnrichmentDiff (write)
// Last Modified: 2026-03-05

import { School, EnrichmentDiff } from '@/lib/entities-server'

function stripHtml(html: string) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

const ENRICHABLE_FIELDS = [
  'name', 'description', 'dayTuition', 'boardingTuition', 'enrollment',
  'avgClassSize', 'studentTeacherRatio', 'curriculum', 'address', 'city',
  'provinceState', 'country', 'phone', 'email', 'website', 'missionStatement',
  'teachingPhilosophy', 'specializations', 'artsPrograms', 'sportsPrograms',
  'clubs', 'languages', 'faithBased', 'genderPolicy', 'schoolTypeLabel',
  'facilities', 'financialAidAvailable', 'financialAidDetails',
  'dayAdmissionDeadline', 'admissionRequirements', 'entranceRequirements',
  'lowestGrade', 'highestGrade'
];

function buildResponseSchema() {
  const properties: Record<string, any> = {};
  for (const field of ENRICHABLE_FIELDS) {
    properties[field] = {
      type: ['object', 'null'],
      properties: {
        value: {},
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['value', 'confidence'],
      additionalProperties: false
    };
  }
  return {
    name: 'school_enrichment',
    schema: {
      type: 'object',
      properties,
      required: ENRICHABLE_FIELDS,
      additionalProperties: false
    }
  };
}

const CONFIDENCE_MAP: Record<string, number> = { high: 0.9, medium: 0.6, low: 0.3 };

export async function enrichSchoolFromWebLogic(params: { schoolId: string; websiteUrl?: string }) {
  const { schoolId, websiteUrl } = params;

  if (!schoolId) {
    throw Object.assign(new Error('schoolId is required'), { status: 400 });
  }

  const schools = await School.filter({ id: schoolId });
  if (!schools || schools.length === 0) {
    throw Object.assign(new Error('School not found'), { status: 404 });
  }
  const school = schools[0];
  let targetUrl = websiteUrl || school.website;
  if (targetUrl && !targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
  if (!targetUrl) return { success: false, error: 'No website URL' };

  console.log(`[ENRICH] School: ${school.name} | URL: ${targetUrl}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let html = '';
  try {
    const fetchRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' }
    });
    html = await fetchRes.text();
  } finally { clearTimeout(timeout); }

  let pageText = stripHtml(html);
  if (pageText.length > 15000) pageText = pageText.substring(0, 15000);
  console.log(`[ENRICH] Page text length after strip: ${pageText.length}`);

  // LLM extraction via OpenRouter
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const responseSchema = buildResponseSchema();
  const prompt = `You are a school data extraction expert. Extract structured school information from the provided website text. For each field, return an object with "value" and "confidence" (high/medium/low). Return null for fields not found on the page.\n\nExtract school information from this website content for the school "${school.name}".\n\nFor each field, return { value: <extracted value or null>, confidence: "high"|"medium"|"low" }.\n\nWEBSITE TEXT:\n${pageText}`;

  console.log('[ENRICH] Calling OpenRouter for LLM extraction');
  const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nextschool.ca',
      'X-OpenRouter-Title': 'NextSchool'
    },
    body: JSON.stringify({
      models: ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini'],
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
      response_format: {
        type: 'json_schema',
        json_schema: responseSchema
      }
    })
  });

  if (!llmResponse.ok) {
    const errText = await llmResponse.text();
    throw new Error(`OpenRouter API error: ${llmResponse.status} ${errText}`);
  }

  const llmData = await llmResponse.json();
  const content = llmData.choices?.[0]?.message?.content;
  let extracted: any = {};
  try {
    extracted = JSON.parse(content);
  } catch (e) {
    console.error('[ENRICH] Failed to parse LLM response:', content?.substring(0, 200));
    return { success: false, error: 'LLM response parse failed', schoolName: school.name };
  }

  const batchId = `${schoolId}_${Date.now()}`;
  let diffsCreated = 0;

  for (const field of ENRICHABLE_FIELDS) {
    const extraction = extracted[field];
    if (!extraction || extraction.value === null || extraction.value === undefined) continue;

    const proposedValue = extraction.value;
    const currentValue = (school as any)[field];

    const proposedStr = Array.isArray(proposedValue) ? JSON.stringify(proposedValue) : String(proposedValue);
    const currentStr = (currentValue === null || currentValue === undefined) ? '' : Array.isArray(currentValue) ? JSON.stringify(currentValue) : String(currentValue);

    if (proposedStr === currentStr) continue;

    await EnrichmentDiff.create({
      school_id: schoolId, field, current_value: currentStr, proposed_value: proposedStr,
      confidence: CONFIDENCE_MAP[extraction.confidence] ?? 0.3,
      source: 'school website', source_url: targetUrl,
      status: 'pending', batch_id: batchId, created_at: new Date().toISOString()
    });
    diffsCreated++;
  }

  return { success: true, batchId, diffsCreated, schoolName: school.name };
}

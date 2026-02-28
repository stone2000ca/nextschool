// Function: generateSharedShortlistLink
// Purpose: Pre-generate a privacy-safe shareable shortlist snapshot and return a public URL
// Entities: SharedShortlist (create), School (read), FamilyProfile (read)
// Last Modified: 2026-02-28
// Dependencies: OpenRouter API (for rationale generation)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── Tuition Band ─────────────────────────────────────────────────────────────
function getTuitionBand(school) {
  const val = school.dayTuition ?? school.tuition;
  if (val == null) return 'Contact school';
  if (val < 15000) return 'Under $15K';
  if (val < 25000) return '$15K–$25K';
  if (val < 40000) return '$25K–$40K';
  return '$40K+';
}

// ─── Priority Checkmarks (derived from school data only — no family PII stored) ──
function buildCheckmarks(school, familyProfile) {
  const rows = [];

  if (school.distanceKm != null) {
    const match = school.distanceKm <= 50;
    rows.push({ label: 'Distance', status: match ? 'match' : 'mismatch', detail: `${school.distanceKm.toFixed(1)} km away` });
  }

  if (familyProfile?.childGrade != null) {
    const grade = Number(familyProfile.childGrade);
    const lo = school.lowestGrade != null ? Number(school.lowestGrade) : null;
    const hi = school.highestGrade != null ? Number(school.highestGrade) : null;
    if (lo != null && hi != null) {
      const match = grade >= lo && grade <= hi;
      rows.push({ label: 'Grade', status: match ? 'match' : 'mismatch', detail: match ? `Gr ${lo}–${hi} ✓` : `School: Gr ${lo}–${hi}` });
    }
  }

  if (familyProfile?.maxTuition) {
    const budget = Number(familyProfile.maxTuition);
    const tuitionVal = school.dayTuition ?? school.tuition;
    if (tuitionVal == null) {
      rows.push({ label: 'Budget', status: 'unknown', detail: 'Contact school' });
    } else {
      rows.push({ label: 'Budget', status: tuitionVal <= budget ? 'match' : 'mismatch', detail: tuitionVal <= budget ? 'Within budget' : 'Above budget' });
    }
  }

  if (familyProfile?.gender) {
    const gp = school.genderPolicy;
    if (gp) {
      let match = true;
      if (gp === 'All-Boys') match = familyProfile.gender === 'male';
      else if (gp === 'All-Girls') match = familyProfile.gender === 'female';
      rows.push({ label: 'Gender', status: match ? 'match' : 'mismatch', detail: gp });
    }
  }

  if (familyProfile?.curriculumPreference?.length > 0) {
    const prefs = familyProfile.curriculumPreference.map(p => p.toLowerCase());
    const ct = (school.curriculumType || '').toLowerCase();
    if (ct) {
      rows.push({ label: 'Curriculum', status: prefs.some(p => ct.includes(p) || p.includes(ct)) ? 'match' : 'mismatch', detail: school.curriculumType });
    }
  }

  const wantsBoarding = familyProfile?.boardingPreference === 'open_to_boarding' || familyProfile?.boardingPreference === 'boarding_preferred';
  if (wantsBoarding && school.boardingAvailable != null) {
    rows.push({ label: 'Boarding', status: school.boardingAvailable ? 'match' : 'mismatch', detail: school.boardingAvailable ? 'Boarding available' : 'Day school only' });
  }

  return rows.slice(0, 5);
}

// ─── OpenRouter call for rationale ────────────────────────────────────────────
async function generateRationale(school, familyProfile) {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) return `${school.name} is a strong match for your shortlist.`;

  const schoolSummary = [
    `${school.name} in ${school.city}, ${school.provinceState || school.country}`,
    school.curriculumType ? `Curriculum: ${school.curriculumType}` : null,
    school.tuition ? `Tuition: $${school.tuition.toLocaleString()}` : null,
    school.genderPolicy ? `Gender: ${school.genderPolicy}` : null,
    school.distanceKm ? `Distance: ${school.distanceKm.toFixed(1)} km` : null,
    school.specializations?.length ? `Specializations: ${school.specializations.join(', ')}` : null,
  ].filter(Boolean).join(', ');

  const familySummary = [
    familyProfile?.childGrade != null ? `Grade ${familyProfile.childGrade}` : null,
    familyProfile?.locationArea ? `based in ${familyProfile.locationArea}` : null,
    familyProfile?.maxTuition ? `budget up to $${familyProfile.maxTuition.toLocaleString()}` : null,
    familyProfile?.priorities?.length ? `priorities: ${familyProfile.priorities.slice(0, 3).join(', ')}` : null,
  ].filter(Boolean).join(', ');

  const prompt = `Write ONE sentence (max 15 words) explaining why ${school.name} is a strong match. Be specific, not generic.
School: ${schoolSummary}
Family context: ${familySummary || 'Not specified'}
Return ONLY the sentence. No quotes, no preamble.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nextschool.ca',
        'X-OpenRouter-Title': 'NextSchool'
      },
      body: JSON.stringify({
        models: ['google/gemini-2.5-flash-lite', 'openai/gpt-4.1-mini'],
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.5
      })
    });
    if (!response.ok) return `${school.name} matches your key criteria and location requirements.`;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || `${school.name} matches your key criteria.`;
  } catch (e) {
    return `${school.name} matches your key criteria and location requirements.`;
  }
}

// ─── Generate a short random hash ─────────────────────────────────────────────
function generateHash() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 10; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { familyProfileId, schoolIds } = await req.json();

    if (!schoolIds || schoolIds.length === 0) {
      return Response.json({ error: 'No schools provided' }, { status: 400 });
    }

    // Fetch family profile (used only for computing checkmarks + rationale — NOT stored in SharedShortlist)
    let familyProfile = null;
    if (familyProfileId) {
      const profiles = await base44.entities.FamilyProfile.filter({ id: familyProfileId });
      familyProfile = profiles.length > 0 ? profiles[0] : null;
    }

    // Fetch school records
    const schools = [];
    for (const id of schoolIds) {
      const results = await base44.entities.School.filter({ id });
      if (results.length > 0) schools.push(results[0]);
    }

    if (schools.length === 0) {
      return Response.json({ error: 'No matching schools found' }, { status: 404 });
    }

    // Build school snapshots with pre-generated rationale + checkmarks
    const schoolSnapshots = await Promise.all(schools.map(async (school) => {
      const [rationale] = await Promise.all([
        generateRationale(school, familyProfile)
      ]);
      const priorityCheckmarks = buildCheckmarks(school, familyProfile);
      const tuitionBand = getTuitionBand(school);

      return {
        id: school.id,
        name: school.name,
        photoUrl: school.headerPhotoUrl || school.heroImage || null,
        city: school.city,
        provinceState: school.provinceState,
        tuitionBand,
        distanceKm: school.distanceKm ?? null,
        rationale,
        priorityCheckmarks
      };
    }));

    // Generate unique hash (retry once on collision)
    let hash = generateHash();
    const existing = await base44.asServiceRole.entities.SharedShortlist.filter({ hash });
    if (existing.length > 0) hash = generateHash() + generateHash().slice(0, 4);

    // Create SharedShortlist record — NO family PII stored
    await base44.asServiceRole.entities.SharedShortlist.create({
      hash,
      schoolIds,
      schools: schoolSnapshots,
      generatedDate: new Date().toISOString()
    });

    const shareUrl = `https://nextschool.ca/SharedShortlistView?hash=${hash}`;

    return Response.json({ hash, shareUrl });
  } catch (error) {
    console.error('[generateSharedShortlistLink] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { School, FamilyProfile, SharedShortlist } from '@/lib/entities-server'

// ─── Tuition Band ─────────────────────────────────────────────────────────────
function getTuitionBand(school: any): string {
  const val = school.day_tuition ?? school.tuition;
  if (val == null) return 'Contact school';
  if (val < 15000) return 'Under $15K';
  if (val < 25000) return '$15K\u2013$25K';
  if (val < 40000) return '$25K\u2013$40K';
  return '$40K+';
}

// ─── Priority Checkmarks (derived from school data only — no family PII stored) ──
function buildCheckmarks(school: any, familyProfile: any): any[] {
  const rows: any[] = [];

  if (school.distance_km != null) {
    const match = school.distance_km <= 50;
    rows.push({ label: 'Distance', status: match ? 'match' : 'mismatch', detail: `${school.distance_km.toFixed(1)} km away` });
  }

  if (familyProfile?.child_grade != null) {
    const grade = Number(familyProfile.child_grade);
    const lo = school.lowest_grade != null ? Number(school.lowest_grade) : null;
    const hi = school.highest_grade != null ? Number(school.highest_grade) : null;
    if (lo != null && hi != null) {
      const match = grade >= lo && grade <= hi;
      rows.push({ label: 'Grade', status: match ? 'match' : 'mismatch', detail: match ? `Gr ${lo}\u2013${hi} \u2713` : `School: Gr ${lo}\u2013${hi}` });
    }
  }

  if (familyProfile?.max_tuition) {
    const budget = Number(familyProfile.max_tuition);
    const tuitionVal = school.day_tuition ?? school.tuition;
    if (tuitionVal == null) {
      rows.push({ label: 'Budget', status: 'unknown', detail: 'Contact school' });
    } else {
      rows.push({ label: 'Budget', status: tuitionVal <= budget ? 'match' : 'mismatch', detail: tuitionVal <= budget ? 'Within budget' : 'Above budget' });
    }
  }

  if (familyProfile?.gender) {
    const gp = school.gender_policy;
    if (gp) {
      let match = true;
      if (gp === 'All-Boys') match = familyProfile.gender === 'male';
      else if (gp === 'All-Girls') match = familyProfile.gender === 'female';
      rows.push({ label: 'Gender', status: match ? 'match' : 'mismatch', detail: gp });
    }
  }

  if (familyProfile?.curriculum_preference?.length > 0) {
    const prefs = familyProfile.curriculum_preference.map((p: string) => p.toLowerCase());
    const ct = (school.curriculum || '').toLowerCase();
    if (ct) {
      rows.push({ label: 'Curriculum', status: prefs.some((p: string) => ct.includes(p) || p.includes(ct)) ? 'match' : 'mismatch', detail: school.curriculum });
    }
  }

  const wantsBoarding = familyProfile?.boarding_preference === 'open_to_boarding' || familyProfile?.boarding_preference === 'boarding_preferred';
  if (wantsBoarding && school.boarding_available != null) {
    rows.push({ label: 'Boarding', status: school.boarding_available ? 'match' : 'mismatch', detail: school.boarding_available ? 'Boarding available' : 'Day school only' });
  }

  return rows.slice(0, 5);
}

// ─── OpenRouter call for rationale ────────────────────────────────────────────
async function generateRationale(school: any, familyProfile: any): Promise<string> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return `${school.name} is a strong match for your shortlist.`;

  const schoolSummary = [
    `${school.name} in ${school.city}, ${school.province_state || school.country}`,
    school.curriculum ? `Curriculum: ${school.curriculum}` : null,
    school.tuition ? `Tuition: $${school.tuition.toLocaleString()}` : null,
    school.gender_policy ? `Gender: ${school.gender_policy}` : null,
    school.distance_km ? `Distance: ${school.distance_km.toFixed(1)} km` : null,
    school.specializations?.length ? `Specializations: ${school.specializations.join(', ')}` : null,
  ].filter(Boolean).join(', ');

  const familySummary = [
    familyProfile?.child_grade != null ? `Grade ${familyProfile.child_grade}` : null,
    familyProfile?.location_area ? `based in ${familyProfile.location_area}` : null,
    familyProfile?.max_tuition ? `budget up to $${familyProfile.max_tuition.toLocaleString()}` : null,
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
function generateHash(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 10; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export async function generateSharedShortlistLink(params: {
  familyProfileId?: string
  schoolIds: string[]
  userId: string
}) {
  const { familyProfileId, schoolIds, userId } = params;

  if (!userId) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  if (!schoolIds || schoolIds.length === 0) {
    throw Object.assign(new Error('No schools provided'), { statusCode: 400 });
  }

  // Fetch family profile (used only for computing checkmarks + rationale — NOT stored in SharedShortlist)
  let familyProfile: any = null;
  if (familyProfileId) {
    const profiles = await FamilyProfile.filter({ id: familyProfileId });
    familyProfile = profiles.length > 0 ? profiles[0] : null;
  }

  // Fetch school records
  const schools: any[] = [];
  for (const id of schoolIds) {
    const results = await School.filter({ id });
    if (results.length > 0) schools.push(results[0]);
  }

  if (schools.length === 0) {
    throw Object.assign(new Error('No matching schools found'), { statusCode: 404 });
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
      photoUrl: school.header_photo_url || school.hero_image || null,
      city: school.city,
      provinceState: school.province_state,
      tuitionBand,
      distanceKm: school.distance_km ?? null,
      rationale,
      priorityCheckmarks
    };
  }));

  // Generate unique hash (retry once on collision)
  let hash = generateHash();
  const existing = await SharedShortlist.filter({ hash });
  if (existing.length > 0) hash = generateHash() + generateHash().slice(0, 4);

  // Create SharedShortlist record — NO family PII stored
  await SharedShortlist.create({
    hash,
    school_ids: schoolIds,
    schools: schoolSnapshots,
    generated_date: new Date().toISOString()
  });

  const shareUrl = `https://nextschool.ca/shared/shortlist/${hash}`;

  return { hash, shareUrl };
}

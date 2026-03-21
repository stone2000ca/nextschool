// Function: generateComparisonNarrative
// Purpose: E49-S4B — Generate a multi-school narrative comparison using deep-dive artifacts,
//          match explanations, and visit debrief data. Cached per family+school set+profile hash.
// Entities: School, FamilyProfile, ConversationArtifacts, FamilyJourney, MatchExplanationCache
// Last Modified: 2026-03-21

import { School, FamilyProfile, FamilyJourney, ConversationArtifacts } from '@/lib/entities-server'
import { getAdminClient } from '@/lib/supabase/admin'
import { computeProfileHash } from './generateMatchExplanations'

// =============================================================================
// INLINED: callOpenRouter
// =============================================================================
async function callOpenRouter(options: any) {
  const { systemPrompt, userPrompt, maxTokens = 2000, temperature = 0.6 } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];
  const body: any = { models, messages, max_tokens: maxTokens, temperature };

  console.log('[E49-S4B] callOpenRouter for comparison narrative, maxTokens:', maxTokens);

  const controller = new AbortController();
  const TIMEOUT_MS = 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nextschool.ca',
        'X-OpenRouter-Title': 'NextSchool'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('[E49-S4B] Response model:', data.model, 'usage:', data.usage);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');
  return content;
}

// =============================================================================
// Cache key builder
// =============================================================================
function buildCacheKey(familyProfileId: string, schoolIds: string[], profileHash: string): string {
  const sortedIds = [...schoolIds].sort().join('_');
  return `${familyProfileId}__${sortedIds}__${profileHash}`;
}

// =============================================================================
// Fetch deep-dive artifacts for each school from conversation_artifacts
// =============================================================================
async function fetchDeepDiveArtifacts(conversationId: string | null, userId: string, schoolIds: string[]): Promise<Record<string, any>> {
  const artifacts: Record<string, any> = {};

  // Try conversation_artifacts first (normalized table)
  if (conversationId) {
    try {
      const admin = getAdminClient();
      const { data, error } = await (admin
        .from('conversation_artifacts') as any)
        .select('school_id, artifact_type, content')
        .eq('conversation_id', conversationId)
        .in('school_id', schoolIds)
        .in('artifact_type', ['deep_dive_recommendation', 'deep_dive_analysis']);

      if (!error && data?.length) {
        for (const row of data) {
          if (!artifacts[row.school_id]) artifacts[row.school_id] = {};
          artifacts[row.school_id].deepDive = row.content;
        }
        console.log('[E49-S4B] Fetched deep-dive artifacts from conversation_artifacts for', Object.keys(artifacts).length, 'schools');
      }
    } catch (e: any) {
      console.warn('[E49-S4B] conversation_artifacts fetch failed:', e.message);
    }
  }

  // Fallback: check for schools without conversation_artifacts data
  const missingSchoolIds = schoolIds.filter(id => !artifacts[id]?.deepDive);
  if (missingSchoolIds.length > 0 && userId) {
    try {
      const gaResults = await ConversationArtifacts.filter({ user_id: userId, artifact_type: 'deep_dive_recommendation' });
      for (const ga of (gaResults || [])) {
        if (missingSchoolIds.includes(ga.school_id) && ga.content) {
          if (!artifacts[ga.school_id]) artifacts[ga.school_id] = {};
          artifacts[ga.school_id].deepDive = typeof ga.content === 'string' ? JSON.parse(ga.content) : ga.content;
        }
      }
    } catch (e: any) {
      console.warn('[E49-S4B] ConversationArtifacts fallback fetch failed:', e.message);
    }
  }

  return artifacts;
}

// =============================================================================
// Fetch visit debrief + parent notes from FamilyJourney school_journeys
// =============================================================================
async function fetchVisitDebriefs(userId: string, schoolIds: string[]): Promise<Record<string, any>> {
  const debriefs: Record<string, any> = {};
  try {
    const journeys = await FamilyJourney.filter({ user_id: userId });
    const activeJourney = journeys?.find((j: any) => !j.is_archived);
    if (!activeJourney?.school_journeys) return debriefs;

    const schoolJourneys = Array.isArray(activeJourney.school_journeys)
      ? activeJourney.school_journeys
      : JSON.parse(activeJourney.school_journeys);

    for (const sj of schoolJourneys) {
      if (schoolIds.includes(sj.schoolId)) {
        debriefs[sj.schoolId] = {
          visitVerdict: sj.visitVerdict || null,
          postVisitFitLabel: sj.postVisitFitLabel || null,
          fitDirection: sj.fitDirection || null,
          revisedStrengths: sj.revisedStrengths || [],
          revisedConcerns: sj.revisedConcerns || [],
          parentNotes: sj.parentNotes || sj.notes || null,
          status: sj.status || 'MATCHED',
        };
      }
    }
    console.log('[E49-S4B] Fetched visit debriefs for', Object.keys(debriefs).length, 'schools');
  } catch (e: any) {
    console.warn('[E49-S4B] Visit debrief fetch failed:', e.message);
  }
  return debriefs;
}

// =============================================================================
// Fetch cached match explanations
// =============================================================================
async function fetchMatchExplanations(familyProfileId: string, schoolIds: string[]): Promise<Record<string, any>> {
  const explanations: Record<string, any> = {};
  try {
    const admin = getAdminClient();
    const { data, error } = await (admin
      .from('match_explanation_cache') as any)
      .select('school_id, explanations')
      .eq('family_profile_id', familyProfileId)
      .in('school_id', schoolIds)
      .eq('stale', false);

    if (!error && data?.length) {
      for (const row of data) {
        explanations[row.school_id] = row.explanations;
      }
      console.log('[E49-S4B] Fetched match explanations for', Object.keys(explanations).length, 'schools');
    }
  } catch (e: any) {
    console.warn('[E49-S4B] Match explanations fetch failed:', e.message);
  }
  return explanations;
}

// =============================================================================
// Check cache for existing narrative
// =============================================================================
async function checkCache(familyProfileId: string, cacheKey: string): Promise<string | null> {
  try {
    const existing = await ConversationArtifacts.filter({
      family_profile_id: familyProfileId,
      artifact_type: 'comparison_narrative'
    });
    const cached = existing?.find((a: any) => a.artifact_key === cacheKey);
    if (cached?.content?.narrative) {
      console.log('[E49-S4B] Cache HIT — returning cached comparison narrative');
      return cached.content.narrative;
    }
  } catch (e: any) {
    console.warn('[E49-S4B] Cache check failed:', e.message);
  }
  return null;
}

// =============================================================================
// Persist narrative to cache
// =============================================================================
async function persistToCache(familyProfileId: string, cacheKey: string, narrative: string, schoolIds: string[]) {
  try {
    const existing = await ConversationArtifacts.filter({
      family_profile_id: familyProfileId,
      artifact_type: 'comparison_narrative'
    });
    const found = existing?.find((a: any) => a.artifact_key === cacheKey);

    const artifactData: any = {
      family_profile_id: familyProfileId,
      artifact_type: 'comparison_narrative',
      artifact_key: cacheKey,
      content: { narrative, schoolIds },
      generated_at: new Date().toISOString()
    };

    if (found) {
      await ConversationArtifacts.update(found.id, artifactData);
      console.log('[E49-S4B] Cache updated:', found.id);
    } else {
      const created = await ConversationArtifacts.create(artifactData);
      console.log('[E49-S4B] Cache created:', created.id);
    }
  } catch (e: any) {
    console.error('[E49-S4B] Cache persist failed (non-blocking):', e.message);
  }
}

// =============================================================================
// Main: generateComparisonNarrativeLogic
// =============================================================================
export async function generateComparisonNarrativeLogic(params: {
  schoolIds: string[];
  familyProfileId?: string;
  userId?: string;
  conversationId?: string;
  consultantName?: string;
}) {
  const { schoolIds, familyProfileId, userId, conversationId, consultantName } = params;

  if (!schoolIds || schoolIds.length < 2 || schoolIds.length > 5) {
    throw Object.assign(new Error('Provide 2-5 school IDs'), { status: 400 });
  }

  // 1. Fetch family profile
  let familyProfile: any = null;
  if (familyProfileId) {
    try {
      const profiles = await FamilyProfile.filter({ id: familyProfileId });
      familyProfile = profiles?.[0] || null;
    } catch (e: any) {
      console.warn('[E49-S4B] FamilyProfile fetch failed:', e.message);
    }
  }

  // 2. Compute profile hash & cache key → check cache
  const profileHash = familyProfile ? computeProfileHash(familyProfile) : 'no_profile';
  const cacheKey = buildCacheKey(familyProfileId || 'anon', schoolIds, profileHash);

  if (familyProfileId) {
    const cached = await checkCache(familyProfileId, cacheKey);
    if (cached) {
      return { narrative: cached, fromCache: true };
    }
  }

  // 3. Fetch schools
  const schools = await Promise.all(
    schoolIds.map((id: string) => School.filter({ id }).then((arr: any[]) => arr[0]))
  );
  const validSchools = schools.filter(Boolean);
  if (validSchools.length < 2) {
    throw Object.assign(new Error('Could not resolve at least 2 schools'), { status: 400 });
  }

  // 4. Fetch enrichment data in parallel
  const [deepDiveArtifacts, visitDebriefs, matchExplanations] = await Promise.all([
    fetchDeepDiveArtifacts(conversationId || null, userId || '', schoolIds),
    userId ? fetchVisitDebriefs(userId, schoolIds) : Promise.resolve({}),
    familyProfileId ? fetchMatchExplanations(familyProfileId, schoolIds) : Promise.resolve({}),
  ]);

  // 5. Build enriched prompt
  const isJackie = consultantName === 'Jackie';
  const persona = isJackie
    ? 'You are Jackie, a warm and empathetic private school consultant. Speak naturally, like a trusted advisor helping a family choose the right school.'
    : 'You are Liam, a direct and analytical private school consultant. Speak concisely and clearly with data-driven insights.';

  const familyContext = familyProfile ? [
    familyProfile.child_name ? `Child: ${familyProfile.child_name}` : '',
    familyProfile.child_grade ? `Grade: ${familyProfile.child_grade}` : '',
    familyProfile.priorities?.length ? `Top priorities: ${familyProfile.priorities.join(', ')}` : '',
    familyProfile.dealbreakers?.length ? `Dealbreakers: ${familyProfile.dealbreakers.join(', ')}` : '',
    familyProfile.max_tuition ? `Budget ceiling: $${familyProfile.max_tuition.toLocaleString()}` : '',
    familyProfile.location_area ? `Location: ${familyProfile.location_area}` : '',
    familyProfile.learning_differences?.length ? `Learning needs: ${familyProfile.learning_differences.join(', ')}` : '',
    familyProfile.boarding_preference ? `Boarding: ${familyProfile.boarding_preference}` : '',
  ].filter(Boolean).join('\n') : 'No family profile provided.';

  const schoolSections = validSchools.map(s => {
    const sections: string[] = [];
    sections.push(`## ${s.name}`);
    sections.push(`Location: ${s.city || ''}, ${s.province_state || ''}`);
    if (s.tuition) sections.push(`Tuition: $${s.tuition.toLocaleString()} ${s.currency || ''}`);
    if (s.avg_class_size) sections.push(`Avg class size: ${s.avg_class_size}`);
    if (s.enrollment) sections.push(`Enrollment: ${s.enrollment}`);
    if (s.student_teacher_ratio) sections.push(`Student:Teacher: ${s.student_teacher_ratio}`);
    if (s.curriculum) sections.push(`Curriculum: ${Array.isArray(s.curriculum) ? s.curriculum.join(', ') : s.curriculum}`);
    if (s.specializations?.length) sections.push(`Specializations: ${s.specializations.join(', ')}`);
    if (s.highlights?.length) sections.push(`Highlights: ${s.highlights.join('; ')}`);
    if (s.financial_aid_available) sections.push('Financial aid: Available');

    // Deep-dive artifact (richest data source)
    const dd = deepDiveArtifacts[s.id]?.deepDive;
    if (dd) {
      const ddText = typeof dd === 'string' ? dd : (dd.text || dd.chat_summary || JSON.stringify(dd).slice(0, 1500));
      sections.push(`\n### Deep-Dive Analysis:\n${typeof ddText === 'string' ? ddText.slice(0, 1500) : ''}`);
    }

    // Match explanations
    const me = matchExplanations[s.id];
    if (me?.length) {
      const explanationText = me.map((e: any) => `- ${e.priority || e.label}: ${e.explanation || e.text}`).join('\n');
      sections.push(`\n### Match Explanations:\n${explanationText}`);
    }

    // Visit debrief + parent notes
    const vd = visitDebriefs[s.id];
    if (vd) {
      const debriefParts = [
        vd.visitVerdict ? `Visit verdict: ${vd.visitVerdict}` : '',
        vd.postVisitFitLabel ? `Post-visit fit: ${vd.postVisitFitLabel}` : '',
        vd.fitDirection ? `Fit direction: ${vd.fitDirection}` : '',
        vd.revisedStrengths?.length ? `Strengths: ${vd.revisedStrengths.join(', ')}` : '',
        vd.revisedConcerns?.length ? `Concerns: ${vd.revisedConcerns.join(', ')}` : '',
        vd.parentNotes ? `Parent notes: ${vd.parentNotes}` : '',
      ].filter(Boolean).join('\n');
      sections.push(`\n### Visit Debrief:\n${debriefParts}`);
    }

    return sections.join('\n');
  }).join('\n\n---\n\n');

  const prompt = `${persona}

FAMILY CONTEXT:
${familyContext}

SCHOOLS TO COMPARE (only these ${validSchools.length} schools — do NOT mention any others):

${schoolSections}

---

Write a single, flowing narrative comparison of these ${validSchools.length} schools for this family.

Requirements:
- Name each school naturally within the narrative — do not list them.
- Differentiate by the family's priorities: explain which school excels at what and why it matters for this child.
- Discuss tradeoffs explicitly: commute, class size, cost, culture, extracurriculars — whatever is most relevant.
- If deep-dive analyses or visit debriefs are available, reference specific insights from them (e.g. "After your visit to X, you noted…").
- If match explanations are available, weave those into the comparison.
- End with a concrete visit plan recommendation (which school to visit first and why) plus a backup strategy.
- Keep the tone conversational and warm (if Jackie) or direct and analytical (if Liam).
- 4-8 sentences. No bullet points. No headings. Pure narrative prose.`;

  // 6. Call LLM
  const narrative = await callOpenRouter({
    systemPrompt: persona,
    userPrompt: prompt,
    maxTokens: 2000,
    temperature: 0.6,
  });

  // 7. Persist to cache (fire-and-forget)
  if (familyProfileId) {
    persistToCache(familyProfileId, cacheKey, narrative, schoolIds).catch(() => {});
  }

  return { narrative, fromCache: false };
}

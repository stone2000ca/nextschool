// Function: generateComparison
// Purpose: Generate AI-powered school comparison matrix and insights, with premium content gating
// Entities: School, FamilyProfile, ConversationArtifacts, User, FamilyJourney
// Last Modified: 2026-03-06

import { School, FamilyProfile, ConversationArtifacts, User, FamilyJourney } from '@/lib/entities-server'

// =============================================================================
// INLINED: callOpenRouter
// =============================================================================
async function callOpenRouter(options: any) {
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.7 } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];

  const body: any = {
    models,
    messages,
    max_tokens: maxTokens,
    temperature
  };

  if (responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: responseSchema.name || 'response',
        strict: true,
        schema: responseSchema.schema
      }
    };
  }

  console.log('[OPENROUTER] Calling generateComparison with models:', body.models, 'maxTokens:', maxTokens);

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
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
    if (error.name === 'AbortError') {
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in generateComparison.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in generateComparison.ts:`, error.message);
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OPENROUTER] API error:', response.status, errorText);
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('[OPENROUTER] Response model used:', data.model, 'usage:', data.usage);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');

  if (responseSchema) {
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('[OPENROUTER] JSON parse failed:', content.substring(0, 200));
      throw new Error('OpenRouter structured output parse failed');
    }
  }

  return content;
}

export async function generateComparisonLogic(params: { schoolIds: string[]; familyProfileId?: string; userId?: string }) {
  const { schoolIds, familyProfileId, userId } = params;

  if (!schoolIds || schoolIds.length < 2 || schoolIds.length > 3) {
    throw Object.assign(new Error('Provide 2-3 school IDs'), { status: 400 });
  }

  // E24-S3-WC1: Resolve user tier for premium content gating
  let isPremiumUser = false;
  if (userId) {
    try {
      const userRecords = await User.filter({ id: userId });
      const userTier = userRecords?.[0]?.tier || 'free';
      isPremiumUser = userTier === 'premium';
      console.log('[E24-S3-WC1] userId:', userId, 'tier:', userTier, 'isPremium:', isPremiumUser);
    } catch (tierErr: any) {
      console.warn('[E24-S3-WC1] Failed to fetch user tier (defaulting to free):', tierErr.message);
    }
  }

  // Fetch schools
  const schools = await Promise.all(
    schoolIds.map((id: string) => School.filter({ id }).then((arr: any[]) => arr[0]))
  );

  // Fetch FamilyProfile if provided
  let familyProfile: any = null;
  if (familyProfileId) {
    try {
      const profiles = await FamilyProfile.filter({ id: familyProfileId });
      familyProfile = profiles?.[0] || null;
    } catch (e: any) { console.warn('[COMPARISON] FamilyProfile fetch failed:', e.message); }
  }

  // E29-016: Fetch active FamilyJourney for journey insights
  let activeJourney: any = null;
  let schoolJourneys: any[] = [];
  if (userId) {
    try {
      const journeys = await FamilyJourney.filter({ user_id: userId });
      activeJourney = journeys?.find((j: any) => !j.is_archived) || null;
      if (activeJourney?.school_journeys) {
        schoolJourneys = Array.isArray(activeJourney.school_journeys) ? activeJourney.school_journeys : JSON.parse(activeJourney.school_journeys);
      }
      console.log('[E29-016] FamilyJourney fetched:', activeJourney?.id, 'schoolJourneys count:', schoolJourneys.length);
    } catch (journeyErr: any) {
      console.warn('[E29-016] FamilyJourney fetch failed:', journeyErr.message);
    }
  }

  // Build comparison structure
  const comparison: any = {
    schools: schools.map((s: any) => ({
      id: s.id,
      name: s.name,
      heroImage: s.header_photo_url || s.hero_image || null,
      city: s.city,
      region: s.region
    })),
    categories: [
      {
        name: 'Basic Info',
        rows: [
          { label: 'Location', values: schools.map((s: any) => `${s.city}, ${s.province_state}`) },
          { label: 'Grades', values: schools.map((s: any) => s.grades_served || (s.lowest_grade && s.highest_grade ? s.lowest_grade + '-' + s.highest_grade : 'N/A')) },
          { label: 'Enrollment', values: schools.map((s: any) => s.enrollment?.toLocaleString()) },
          { label: 'Founded', values: schools.map((s: any) => s.founded) },
          { label: 'Curriculum', values: schools.map((s: any) => s.curriculum) }
        ]
      },
      {
        name: 'Academics',
        rows: [
          { label: 'Avg Class Size', values: schools.map((s: any) => s.avg_class_size) },
          { label: 'Student:Teacher', values: schools.map((s: any) => s.student_teacher_ratio) },
          { label: 'Specializations', values: schools.map((s: any) => s.specializations?.join(', ') || 'None') }
        ]
      },
      {
        name: 'Cost',
        rows: [
          { label: 'Annual Tuition', values: schools.map((s: any) => `${s.currency} ${s.tuition?.toLocaleString()}`) },
          { label: 'Financial Aid', values: schools.map((s: any) => s.financial_aid_available ? 'Available' : 'Not available') }
        ]
      },
      {
        name: 'Programs',
        rows: [
          { label: 'Arts', values: schools.map((s: any) => s.arts_programs?.slice(0, 3).join(', ') || 'None') },
          { label: 'Sports', values: schools.map((s: any) => s.sports_programs?.slice(0, 3).join(', ') || 'None') },
          { label: 'Languages', values: schools.map((s: any) => s.languages?.join(', ') || 'None') }
        ]
      }
    ]
  };

  // E29-016: Add Journey Insights category for premium users
  if (isPremiumUser && activeJourney && schoolJourneys.length > 0) {
    const journeyRows = [
      { label: 'Post-Visit Fit', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.postVisitFitLabel || 'Not yet visited'; }) },
      { label: 'Visit Verdict', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.visitVerdict || 'Pending'; }) },
      { label: 'Fit Direction', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.fitDirection || '-'; }) },
      { label: 'Key Strengths', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return (sj?.revisedStrengths || []).join(', ') || 'TBD'; }) },
      { label: 'Open Concerns', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return (sj?.revisedConcerns || []).join(', ') || 'None'; }) },
      { label: 'Status', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.status || 'MATCHED'; }) }
    ];
    comparison.categories.push({ name: 'Journey Insights', rows: journeyRows });
    console.log('[E29-016] Journey Insights category added for premium user');
  }

  // Generate AI insights
  let insights: any = { insights: [] };
  try {
    const schoolNames = schools.map((s: any) => s.name).join(', ');
    const prioritiesStr = familyProfile?.priorities?.join(', ') || 'not specified';
    const dealbreakersStr = familyProfile?.dealbreakers?.join(', ') || 'none';

    const insightSystemPrompt = `You are an education consultant generating comparison insights for schools. Generate 3-5 concise, actionable insights that help a family compare these schools based on their priorities. Each insight should be 1-2 sentences. Return ONLY valid JSON.`;

    const insightUserPrompt = `SCHOOLS BEING COMPARED: ${schoolNames}

COMPARISON DATA:
${JSON.stringify(comparison.categories, null, 2)}

FAMILY PRIORITIES: ${prioritiesStr}
FAMILY DEALBREAKERS: ${dealbreakersStr}
CHILD GRADE: ${familyProfile?.child_grade || 'not specified'}
BUDGET: ${familyProfile?.max_tuition ? '$' + familyProfile.max_tuition.toLocaleString() : 'not specified'}

Generate 3-5 comparison insights. Return JSON: { "insights": ["insight 1", "insight 2", ...] }`;

    const llmResponse = await callOpenRouter({
      systemPrompt: insightSystemPrompt,
      userPrompt: insightUserPrompt,
      maxTokens: 800,
      temperature: 0.5
    });

    let parsed = llmResponse;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }

    if (parsed?.insights && Array.isArray(parsed.insights)) {
      insights = parsed;
      console.log('[E25-S5] LLM generated', insights.insights.length, 'comparison insights');
    } else {
      console.warn('[E25-S5] LLM response did not contain valid insights');
    }
  } catch (insightError: any) {
    console.error('[E25-S5] LLM insights generation failed (non-blocking):', insightError.message);
  }

  // Build family-personalized comparisonMatrix
  const priorities = familyProfile?.priorities || [];
  const dealbreakers = familyProfile?.dealbreakers || [];
  const prioritySet = new Set(priorities.map((p: string) => p.toLowerCase()));

  const comparisonMatrix: any = {
    schools: comparison.schools,
    dimensions: comparison.categories.flatMap((cat: any) => {
      if (cat.name === 'Journey Insights') {
        return cat.rows.map((row: any) => ({ category: cat.name, label: row.label, values: row.values }));
      }
      return cat.rows.map((row: any) => ({
        category: cat.name,
        label: row.label,
        values: row.values,
        relevance: (() => { const label = row.label.toLowerCase(); const isP = [...prioritySet].some((p: string) => label.includes(p) || p.includes(label) || label.split(' ').some((w: string) => p.includes(w))); return isP ? 'priority' : null; })()
          || (dealbreakers?.some((d: string) => { const label = row.label.toLowerCase(); const db = d.toLowerCase(); return label.includes(db) || db.includes(label) || db.split(' ').some((w: string) => w.length > 3 && label.includes(w)); }) ? 'dealbreaker' : 'neutral')
      }));
    })
  };

  // E24-S3-WC1: Gate premium content for non-premium users
  let finalInsights = insights.insights;
  let isLocked = false;
  let tradeoffNarration: any = null;

  if (!isPremiumUser) {
    finalInsights = null;
    comparisonMatrix.dimensions = comparisonMatrix.dimensions.map(({ relevance, ...rest }: any) => rest);
    isLocked = true;
    console.log('[E24-S3-WC1] Comparison insights and relevance tags gated for non-premium user');
  }

  comparison.insights = finalInsights;

  // Persist to ConversationArtifacts (non-blocking)
  if (familyProfileId) {
    try {
      const artifactKey = [...schoolIds].sort().join('_');
      const existing = await ConversationArtifacts.filter({
        family_profile_id: familyProfileId,
        artifact_type: 'comparison'
      });
      const found = existing?.find((a: any) => a.artifact_key === artifactKey);

      const artifactData: any = {
        family_profile_id: familyProfileId,
        artifact_type: 'comparison',
        artifact_key: artifactKey,
        content: {
          comparisonMatrix,
          insights: finalInsights,
          isLocked,
          tradeoffNarration
        },
        generated_at: new Date().toISOString()
      };

      if (found) {
        await ConversationArtifacts.update(found.id, artifactData);
        console.log('[COMPARISON] ConversationArtifacts updated:', found.id);
      } else {
        const created = await ConversationArtifacts.create(artifactData);
        console.log('[COMPARISON] ConversationArtifacts created:', created.id);
      }
    } catch (persistError: any) {
      console.error('[COMPARISON] ConversationArtifacts persistence failed (non-blocking):', persistError.message);
    }
  }

  return {
    ...comparison,
    comparisonMatrix,
    isLocked,
    journeyPhase: activeJourney?.current_phase || null,
    tradeoffNarration
  };
}

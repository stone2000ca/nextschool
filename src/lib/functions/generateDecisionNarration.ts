// Function: generateDecisionNarration
// Purpose: Generate honest tradeoff analysis and decision narration with optional debrief data
// Entities: FamilyProfile, ComparisonMatrix (via input), SchoolJourney (via input)
// Last Modified: 2026-03-18

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

  console.log('[OPENROUTER] Calling generateDecisionNarration with models:', body.models, 'maxTokens:', maxTokens);

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
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in generateDecisionNarration.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in generateDecisionNarration.ts:`, error.message);
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

export async function generateDecisionNarrationLogic(params: {
  schools: any[];
  comparisonMatrix: any;
  familyProfile: any;
  schoolJourneys: any[];
  isPremiumUser: boolean;
}) {
  const { schools, comparisonMatrix, familyProfile, schoolJourneys, isPremiumUser } = params;

  // E29-017: Return null immediately for non-premium users to avoid LLM cost
  if (!isPremiumUser) {
    return null;
  }

  // Compute whether we have post-visit debrief data
  const hasDebriefs = Array.isArray(schoolJourneys) && schoolJourneys.some((j: any) => j?.postVisitFitLabel || j?.visitVerdict || (j?.revisedConcerns?.length > 0));

  // Return default response if insufficient personalized data
  if (!familyProfile && (!Array.isArray(schoolJourneys) || schoolJourneys.length === 0)) {
    return {
      hasDebriefs: false,
      narrative: null,
      tradeoffs: [],
      nextStep: null,
      limitationsNotice: 'Not enough personalized data available for tradeoff analysis.'
    };
  }

  try {
    // Build briefSummary from familyProfile
    const briefSummary = familyProfile ? {
      priorities: familyProfile.priorities || [],
      dealbreakers: familyProfile.dealbreakers || [],
      childAge: familyProfile.childAge || null,
      childGrade: familyProfile.childGrade || null,
      learningDifferences: familyProfile.learningDifferences || [],
      budgetRange: familyProfile.budgetRange || null,
      maxTuition: familyProfile.maxTuition || null,
      goals: familyProfile.interests || []
    } : null;

    // Build comparisonSummary from comparisonMatrix dimensions
    const comparisonSummary = comparisonMatrix?.dimensions?.map((dim: any) => ({
      category: dim.category,
      label: dim.label,
      values: dim.values,
      relevance: dim.relevance || null
    })) || [];

    // Build debriefSummary from schoolJourneys if available
    let debriefSummary: any = null;
    if (hasDebriefs && Array.isArray(schoolJourneys)) {
      debriefSummary = schoolJourneys.map((j: any) => ({
        schoolId: j.schoolId,
        schoolName: j.schoolName || 'Unknown School',
        status: j.status || 'MATCHED',
        postVisitFitLabel: j.postVisitFitLabel || null,
        visitVerdict: j.visitVerdict || null,
        revisedStrengths: j.revisedStrengths || [],
        revisedConcerns: j.revisedConcerns || []
      }));
    }

    const schoolNames = schools.map((s: any) => s.name).join(', ');

    const systemPrompt = `You are an experienced education consultant providing an honest tradeoff analysis to help a family make a school decision. Be candid about both strengths and concerns. ${hasDebriefs ? 'The family has visited some of these schools — incorporate their post-visit observations.' : ''} Return ONLY valid JSON.`;

    const userPrompt = `SCHOOLS: ${schoolNames}

FAMILY BRIEF:
${JSON.stringify(briefSummary, null, 2)}

COMPARISON DATA:
${JSON.stringify(comparisonSummary, null, 2)}

${debriefSummary ? `POST-VISIT OBSERVATIONS:\n${JSON.stringify(debriefSummary, null, 2)}` : ''}

Generate an honest tradeoff analysis. Return JSON:
{
  "narrative": "A 2-3 paragraph honest analysis of these schools for this family, noting key tradeoffs and what matters most given their priorities.",
  "tradeoffs": ["tradeoff 1", "tradeoff 2", "tradeoff 3"],
  "nextStep": "A specific, actionable recommendation for their next step."
}`;

    const llmResponse = await callOpenRouter({
      systemPrompt,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.5
    });

    let parsed = llmResponse;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }

    if (parsed?.narrative || parsed?.tradeoffs) {
      const output = {
        hasDebriefs,
        narrative: parsed.narrative || null,
        tradeoffs: Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [],
        nextStep: parsed.nextStep || null,
        limitationsNotice: null
      };
      console.log('[E29-017] Decision narration generated successfully');
      return output;
    }

    console.warn('[E29-017] LLM response did not contain valid narration');
    return {
      hasDebriefs,
      narrative: null,
      tradeoffs: [],
      nextStep: null,
      limitationsNotice: 'Unable to generate tradeoff analysis at this time.'
    };
  } catch (error: any) {
    console.error('[E29-017] generateDecisionNarration failed:', error.message);
    return {
      hasDebriefs,
      narrative: null,
      tradeoffs: [],
      nextStep: null,
      limitationsNotice: 'Unable to generate tradeoff analysis at this time.'
    };
  }
}

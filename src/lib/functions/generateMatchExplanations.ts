// Function: generateMatchExplanations
// Purpose: Generate AI-powered match explanations for school-family pairs
// Entities: (none - uses passed data)
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

  console.log('[OPENROUTER] Calling generateMatchExplanations with models:', body.models, 'maxTokens:', maxTokens);

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
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in generateMatchExplanations.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in generateMatchExplanations.ts:`, error.message);
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

export async function generateMatchExplanationsLogic(params: { familyProfile: any; schools: any[] }) {
  const { familyProfile, schools } = params;

  if (!familyProfile || !schools || schools.length === 0) {
    return {
      explanations: schools?.map((s: any) => ({ schoolId: s.id, matches: [] })) || []
    };
  }

  // Build context about the family
  const familyContext = `
Child's Name: ${familyProfile.child_name || 'Not specified'}
Grade Level: ${familyProfile.child_grade}
Academic Strengths: ${familyProfile.academic_strengths?.join(', ') || 'Not specified'}
Academic Struggles: ${familyProfile.academic_struggles?.join(', ') || 'None mentioned'}
Interests: ${familyProfile.interests?.join(', ') || 'Not specified'}
Personality Traits: ${familyProfile.personality_traits?.join(', ') || 'Not specified'}
Learning Style: ${familyProfile.learning_style || 'Not specified'}
Priorities: ${familyProfile.priorities?.join(', ') || 'Not specified'}
Budget: $${familyProfile.max_tuition || 'Not specified'} per year
Location: ${familyProfile.location_area || 'Not specified'}
Commute Tolerance: ${familyProfile.commute_tolerance_minutes || 'Not specified'} minutes
Curriculum Preferences: ${familyProfile.curriculum_preference?.join(', ') || 'Not specified'}
Boarding Preference: ${familyProfile.boarding_preference || 'Not specified'}
Deal Breakers: ${familyProfile.dealbreakers?.join(', ') || 'None mentioned'}
`;

  const schoolsList = schools.map((s: any) => `
- ${s.name} (ID: ${s.id}) (${s.city}, ${s.province_state})
  Curriculum: ${s.curriculum}
  Tuition: $${s.tuition}
  Specializations: ${s.specializations?.join(', ') || 'General'}
  Gender Policy: ${s.gender_policy || 'Not specified'}
  Class Size: ${s.avg_class_size || 'Not specified'}
  Financial Aid: ${s.financial_aid_available ? 'Yes' : 'No'}
  Sports: ${s.sports_programs?.slice(0, 3).join(', ') || 'Not specified'}
  Arts: ${s.arts_programs?.slice(0, 3).join(', ') || 'Not specified'}
  Distance: ${s.distance_km ? s.distance_km.toFixed(1) + ' km' : 'Not calculated'}
`).join('\n');

  // Fallback explanations in case LLM call fails
  const fallbackExplanations = schools.map((school: any) => {
    return {
      schoolId: school.id,
      matches: [
        { type: "positive", text: "Offers quality education" },
        { type: "positive", text: "Meets grade requirements" },
        { type: "tradeoff", text: "Consider visiting for full picture" }
      ]
    };
  });

  try {
    const systemPrompt = `You are an education consultant generating personalized match explanations for school-family pairs. For each school, generate 2-3 match points that explain WHY this school is a good (or imperfect) fit for this specific family based on their profile. Each match point should be specific and reference the family's actual priorities, interests, or constraints. Return ONLY valid JSON. Do NOT explain.`;

    const userPrompt = `FAMILY PROFILE:
${familyContext}

SCHOOLS:
${schoolsList}

For each school, generate 2-3 match explanations. Each explanation has:
- type: "positive" (school matches a family need) or "tradeoff" (a consideration or potential concern)
- text: A concise, specific sentence (max 20 words) referencing the family's actual needs

Return JSON in this exact format:
{
  "explanations": [
    {
      "schoolId": "<school entity ID>",
      "matches": [
        { "type": "positive", "text": "..." },
        { "type": "tradeoff", "text": "..." }
      ]
    }
  ]
}`;

    const llmResponse = await callOpenRouter({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.4
    });

    let parsed = llmResponse;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }

    if (parsed?.explanations && Array.isArray(parsed.explanations)) {
      // Validate that all school IDs are present
      const schoolIdSet = new Set(schools.map((s: any) => s.id));
      const validExplanations = parsed.explanations.filter((e: any) => schoolIdSet.has(e.schoolId));
      // Fill in any missing schools with fallback
      const explainedIds = new Set(validExplanations.map((e: any) => e.schoolId));
      for (const school of schools) {
        if (!explainedIds.has(school.id)) {
          validExplanations.push(fallbackExplanations.find((f: any) => f.schoolId === school.id));
        }
      }
      console.log('[generateMatchExplanations] LLM generated explanations for', validExplanations.length, 'schools');
      return { explanations: validExplanations };
    }

    console.warn('[generateMatchExplanations] LLM response did not contain valid explanations, using fallback');
    return { explanations: fallbackExplanations };
  } catch (error: any) {
    console.error('[generateMatchExplanations] LLM call failed, using fallback:', error.message);
    return { explanations: fallbackExplanations };
  }
}

// Function: handleBrief
// Purpose: Handle the BRIEF state — generate family brief summary for Jackie (LLM) and Liam (deterministic)
// Entities: FamilyProfile (read via passed payload, no direct DB writes)
// Last Modified: 2026-03-09
// Dependencies: OpenRouter API (callOpenRouter)

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

  console.log('[OPENROUTER] Calling with models:', body.models, 'maxTokens:', maxTokens);

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
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in handleBrief.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in handleBrief.ts:`, error.message);
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

// =============================================================================
// MAIN: handleBriefLogic
// =============================================================================
export async function handleBriefLogic(params: any) {
  const {
    message,
    localProfile: rawProfile,
    context: rawContext,
    conversationHistory,
    consultantName,
    briefStatus,
    flags,
    returningUserContextBlock
  } = params;

  const localProfile = JSON.parse(JSON.stringify(rawProfile || {}));
  let context = rawContext || {};

  // S108-WC3 Fix 2: Belt-and-suspenders fallback
  const accumulated = context.accumulatedFamilyProfile || {};
  for (const [key, value] of Object.entries(accumulated)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const existing = localProfile[key];
    const isEmpty = existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0);
    if (isEmpty) {
      localProfile[key] = value;
      console.log(`[BRIEF-S108] Backfilled from accumulatedFamilyProfile: ${key} =`, value);
    }
  }

  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE' };
  const BRIEF_STATUS = { GENERATING: 'generating', PENDING_REVIEW: 'pending_review', EDITING: 'editing', CONFIRMED: 'confirmed' };

  let msgLower = (message || '').toLowerCase();
  let updatedBriefStatus = briefStatus;
  let briefMessage: string;

  const isInitialAdjustRequest = /\b(change|adjust|edit|actually|wait|hold on|no|not right|different|let me|redo)\b/i.test(msgLower) &&
                                  !/budget|grade|location|school|curriculum|priority/i.test(msgLower);

  if ((updatedBriefStatus === BRIEF_STATUS.EDITING || updatedBriefStatus === BRIEF_STATUS.PENDING_REVIEW) && isInitialAdjustRequest) {
    const adjustSystemPrompt = consultantName === 'Jackie'
      ? `You are Jackie, a warm and encouraging education consultant. The parent wants to adjust something in their brief. Ask them a warm, open-ended question about what they'd like to change. Max 50 words.`
      : `You are Liam, a direct and strategic education consultant. The parent wants to adjust their brief. Ask them directly what needs to change. Max 50 words.`;

    const adjustUserPrompt = `The parent message was: "${message}"\n\nAsk what needs adjustment in their brief.`;

    let adjustMessage = "What would you like to adjust?";
    try {
      const adjustResponse = await callOpenRouter({ systemPrompt: adjustSystemPrompt, userPrompt: adjustUserPrompt, maxTokens: 300, temperature: 0.5 });
      adjustMessage = adjustResponse || "What would you like to adjust?";
    } catch (openrouterError) {
      console.error('[FALLBACK ERROR] BRIEF adjustment failed:', (openrouterError as any).message);
    }

    return {
      message: adjustMessage,
      state: STATES.BRIEF,
      briefStatus: BRIEF_STATUS.EDITING,
      familyProfile: localProfile,
      conversationContext: context,
      schools: []
    };
  } else if (updatedBriefStatus === BRIEF_STATUS.EDITING && !isInitialAdjustRequest) {
    updatedBriefStatus = BRIEF_STATUS.GENERATING;
  }

  if (context.extractedEntities) {
    for (const [key, value] of Object.entries(context.extractedEntities)) {
      if (value !== null && value !== undefined) {
        const existing = localProfile[key];
        if (Array.isArray(value)) {
          const currentArray = Array.isArray(existing) ? existing : [];
          const merged = [...new Set([...currentArray, ...(value as any[])])];
          localProfile[key] = merged;
        } else if (existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0)) {
          localProfile[key] = value;
        }
      }
    }
  }

  try {
    const { child_name, child_grade, location_area, interests, priorities, dealbreakers, parent_notes } = localProfile;
    let max_tuition = localProfile.max_tuition;
    if ((!max_tuition || max_tuition === null || max_tuition === undefined) && context.extractedEntities?.max_tuition) {
      max_tuition = context.extractedEntities.max_tuition;
      console.log('[BRIEF] Using extracted max_tuition:', max_tuition);
    }
    const interestsStr = Array.isArray(interests) && interests.length > 0 ? interests.join(', ') : '';
    const prioritiesStr = priorities?.length > 0 ? priorities.join(', ') : '';
    const dealbreakersStr = dealbreakers?.length > 0 ? dealbreakers.join(', ') : '';

    let budgetDisplay = 'Not yet shared';
    if (max_tuition === 'unlimited') {
      budgetDisplay = 'Budget is flexible';
    } else if (max_tuition && typeof max_tuition === 'number') {
      budgetDisplay = `$${max_tuition.toLocaleString()}/year`;
    } else if (max_tuition && typeof max_tuition === 'string') {
      budgetDisplay = max_tuition;
    }

    const briefChildGenderLabel = localProfile?.gender === 'male'
      ? 'Your son'
      : localProfile?.gender === 'female'
      ? 'Your daughter'
      : 'Your child';
    let briefChildDisplayName = child_name ? child_name : briefChildGenderLabel;

    let briefMessageText = "Let me summarize what you've shared.";

    if (consultantName === 'Liam') {
      const briefLines = ["Here's what I've put together so far:\n"];
      const childLabel = localProfile?.gender === 'male'
        ? 'Your son'
        : localProfile?.gender === 'female'
        ? 'Your daughter'
        : 'Your child';
      const childDisplay = child_name ? child_name : childLabel;
      if (child_name || child_grade !== null && child_grade !== undefined) {
        briefLines.push(`- **Child:** ${childDisplay}${child_grade !== null && child_grade !== undefined ? ', Grade ' + child_grade : ''}`);
      }
      if (location_area) briefLines.push(`- **Location:** ${location_area}`);
      if (max_tuition) {
        const budgetStr = max_tuition === 'unlimited' ? 'Flexible' : typeof max_tuition === 'number' ? `Up to $${max_tuition.toLocaleString()}` : String(max_tuition);
        briefLines.push(`- **Budget:** ${budgetStr}`);
      }
      if ((priorities || []).length > 0) briefLines.push(`- **Priorities:** ${(priorities || []).join(', ')}`);
      if ((interests || []).length > 0) briefLines.push(`- **Interests:** ${(interests || []).join(', ')}`);
      if ((dealbreakers || []).length > 0) briefLines.push(`- **Dealbreakers:** ${(dealbreakers || []).join(', ')}`);
      briefLines.push("\nDoes that look right? Anything to change?");
      briefMessageText = briefLines.join('\n');
      console.log('[BRIEF] Liam brief built deterministically');
    } else {
      const childLabel = localProfile?.gender === 'male'
        ? 'Your son'
        : localProfile?.gender === 'female'
        ? 'Your daughter'
        : 'Your child';
      const childDisplay = child_name ? child_name : childLabel;
      const programmaticFallback = [
        "Here's what I'm hearing from you so far:\n",
        child_name || child_grade !== null && child_grade !== undefined ? `- **Child:** ${childDisplay}${child_grade !== null && child_grade !== undefined ? ', Grade ' + child_grade : ''}` : null,
        location_area ? `- **Location:** ${location_area}` : null,
        max_tuition ? `- **Budget:** ${max_tuition === 'unlimited' ? 'Flexible' : typeof max_tuition === 'number' ? `Up to $${max_tuition.toLocaleString()}` : String(max_tuition)}` : null,
        (priorities || []).length > 0 ? `- **Priorities:** ${(priorities || []).join(', ')}` : null,
        (interests || []).length > 0 ? `- **Interests:** ${(interests || []).join(', ')}` : null,
        (dealbreakers || []).length > 0 ? `- **Dealbreakers:** ${(dealbreakers || []).join(', ')}` : null,
        "\nDoes that capture it? Anything to adjust?"
      ].filter(line => line !== null).join('\n');

      const jackieBriefSystemPrompt = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}[STATE: BRIEF] You are Jackie, a warm and experienced education consultant. Generate a brief summary of what the family has shared. Use ONLY what was explicitly stated by the parent.

FIELD DISPLAY RULES: Include all non-empty fields from the profile. Omit any field that has no data. Never display "(not specified)" or "(none)" — if a field is empty, skip it entirely.

    CRITICAL RULES:
    - Start with a warm, natural conversational sentence (1-2 sentences) acknowledging the family's situation before the numbered summary.
    - Do NOT invent personality traits, motivations, or character descriptions that were not explicitly stated by the parent.
    - If no personality was described, skip that section entirely.
    - End with: "Does that capture it? Anything to adjust?"

    YOU ARE JACKIE — warm, empathetic, experienced.`;

      const jackieBriefUserPrompt = `Generate the family brief summary.

FAMILY DATA:
- CHILD: ${briefChildDisplayName}
- GRADE: ${child_grade !== null && child_grade !== undefined ? 'Grade ' + child_grade : 'Not yet shared'}
- LOCATION: ${location_area || 'Not yet shared'}
- BUDGET: ${budgetDisplay}
- PRIORITIES: ${prioritiesStr || 'Not yet shared'}
- INTERESTS: ${interestsStr || 'Not yet shared'}
- DEALBREAKERS: ${dealbreakersStr || 'Not yet shared'}

Format:
- Open with a warm 1-2 sentence intro
- Then a numbered list:
  ${child_grade !== null && child_grade !== undefined ? '1. ' + briefChildDisplayName + ': Grade ' + child_grade : ''}
  ${location_area ? '2. Location: ' + location_area : ''}
  ${budgetDisplay !== 'Not yet shared' ? '3. Budget: ' + budgetDisplay : ''}
  ${prioritiesStr ? '4. Top priorities: ' + prioritiesStr : ''}
  ${interestsStr ? '5. Interests: ' + interestsStr : ''}
  ${dealbreakersStr ? '6. Dealbreakers: ' + dealbreakersStr : ''}
- End with: "Does that capture it? Anything to adjust?"`;

      try {
        const briefResult = await callOpenRouter({
          systemPrompt: jackieBriefSystemPrompt,
          userPrompt: jackieBriefUserPrompt,
          maxTokens: 500,
          temperature: 0.5
        });
        briefMessageText = briefResult || programmaticFallback;
      } catch (openrouterError) {
        console.log('[BRIEF] OpenRouter failed for Jackie, using programmatic fallback');
        briefMessageText = programmaticFallback;
      }
    }
    // E41-S9: Append "What Else We've Learned" section from parent_notes[]
    if (Array.isArray(parent_notes) && parent_notes.length > 0) {
      const notesSection = '\n\n## What Else We\'ve Learned\n' +
        parent_notes.map((note: string) => `- ${note}`).join('\n');
      briefMessageText = briefMessageText + notesSection;
      console.log('[BRIEF] Appended parent_notes section:', parent_notes.length, 'notes');
    }
    briefMessage = briefMessageText;
  } catch (e: any) {
    console.error('[ERROR] All BRIEF generation failed:', e.message);
    briefMessage = "Let me summarize what you've shared.";
  }

  if (updatedBriefStatus === BRIEF_STATUS.GENERATING) {
    updatedBriefStatus = BRIEF_STATUS.PENDING_REVIEW;
    console.log('[BRIEF GENERATED] Set briefStatus to pending_review');
  }

  const updatedCtx = { ...context, briefStatus: updatedBriefStatus };

  return {
    message: briefMessage,
    state: STATES.BRIEF,
    briefStatus: updatedBriefStatus,
    familyProfile: localProfile,
    conversationContext: updatedCtx,
    schools: []
  };
}

// Function: handleResults
// Purpose: Handle the RESULTS state — run school search, generate consultant narration
// Entities: FamilyProfile (read), SchoolAnalysis (read), ChatSession (update for WC10 narrative)
// Last Modified: 2026-03-09
// Dependencies: OpenRouter API, searchSchools

import { ChatSession, LLMLog, TourRequest } from '@/lib/entities-server'
import { searchSchoolsLogic } from './searchSchools'

// =============================================================================
// T045: Canadian Metro Coordinates Lookup
// =============================================================================
const CANADIAN_METRO_COORDS: Record<string, { lat: number; lng: number }> = {
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'gta': { lat: 43.6532, lng: -79.3832 },
  'greater toronto area': { lat: 43.6532, lng: -79.3832 },
  'toronto area': { lat: 43.6532, lng: -79.3832 },
  'north york': { lat: 43.7615, lng: -79.4111 },
  'scarborough': { lat: 43.7764, lng: -79.2318 },
  'markham': { lat: 43.8561, lng: -79.3370 },
  'richmond hill': { lat: 43.8828, lng: -79.4403 },
  'vaughan': { lat: 43.8361, lng: -79.4983 },
  'oakville': { lat: 43.4675, lng: -79.6877 },
  'burlington': { lat: 43.3255, lng: -79.7990 },
  'mississauga': { lat: 43.5890, lng: -79.6441 },
  'brampton': { lat: 43.7315, lng: -79.7624 },
  'vancouver': { lat: 49.2827, lng: -123.1207 },
  'greater vancouver': { lat: 49.2827, lng: -123.1207 },
  'greater vancouver area': { lat: 49.2827, lng: -123.1207 },
  'lower mainland': { lat: 49.2827, lng: -123.1207 },
  'metro vancouver': { lat: 49.2827, lng: -123.1207 },
  'montreal': { lat: 45.5017, lng: -73.5673 },
  'québec city': { lat: 46.8139, lng: -71.2080 },
  'quebec city': { lat: 46.8139, lng: -71.2080 },
  'ottawa': { lat: 45.4215, lng: -75.6972 },
  'hamilton': { lat: 43.2557, lng: -79.8711 },
  'london on': { lat: 42.9849, lng: -81.2453 },
  'london ontario': { lat: 42.9849, lng: -81.2453 },
  'london': { lat: 42.9849, lng: -81.2453 },
  'kitchener': { lat: 43.4516, lng: -80.4925 },
  'waterloo': { lat: 43.4668, lng: -80.5164 },
  'windsor': { lat: 42.3149, lng: -83.0364 },
  'calgary': { lat: 51.0447, lng: -114.0719 },
  'edmonton': { lat: 53.5461, lng: -113.4938 },
  'winnipeg': { lat: 49.8951, lng: -97.1384 },
  'saskatoon': { lat: 52.1332, lng: -106.6700 },
  'regina': { lat: 50.4452, lng: -104.6189 },
  'halifax': { lat: 44.6488, lng: -63.5752 },
  'victoria': { lat: 48.4284, lng: -123.3656 },
  'st. john\'s': { lat: 47.5615, lng: -52.7126 },
  'st johns': { lat: 47.5615, lng: -52.7126 },
  'st johns nl': { lat: 47.5615, lng: -52.7126 },
  'whitehorse': { lat: 60.7212, lng: -135.0568 },
};

function resolveLocationCoords(locationArea: string | null) {
  if (!locationArea) return null;
  const key = locationArea.toLowerCase().trim();
  if (CANADIAN_METRO_COORDS[key]) return CANADIAN_METRO_COORDS[key];
  for (const [cityKey, coords] of Object.entries(CANADIAN_METRO_COORDS)) {
    if (key.includes(cityKey) || cityKey.includes(key)) {
      console.log(`[T045] Partial match: '${key}' → '${cityKey}'`);
      return coords;
    }
  }
  return null;
}

// =============================================================================
// INLINED: callOpenRouter
// =============================================================================
async function callOpenRouter(options: any) {
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.7, _logContext, tools, toolChoice, returnRaw = false } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];

  const body: any = { models, messages, max_tokens: maxTokens, temperature };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

  if (responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: responseSchema.name || 'response', strict: true, schema: responseSchema.schema }
    };
  }

  console.log('[OPENROUTER] Calling with models:', body.models, 'maxTokens:', maxTokens);

  const startTime = Date.now();
  const fullPromptStr = messages.map((m: any) => `[${m.role}] ${m.content}`).join('\n');

  const controller = new AbortController();
  const TIMEOUT_MS = 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OPENROUTER] API error:', response.status, errorText);

      if (_logContext) {
        const isTest = _logContext.is_test === true;
        LLMLog.create({
          conversation_id: _logContext.conversationId || 'unknown',
          phase: _logContext.phase || 'unknown',
          model: 'unknown',
          prompt_summary: fullPromptStr.substring(0, 500),
          response_summary: errorText.substring(0, 500),
          token_count_in: 0, token_count_out: 0, latency_ms,
          status: 'error', is_test: isTest,
          ...(isTest ? { full_prompt: fullPromptStr } : {}),
          error_message: `HTTP ${response.status}: ${errorText.substring(0, 300)}`
        }).catch((e: any) => console.error('[E18c-002] LLMLog write failed:', e.message));
      }

      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[OPENROUTER] Response model used:', data.model, 'usage:', data.usage);

    const content = data.choices?.[0]?.message?.content;
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (!content && toolCalls.length === 0) throw new Error('OpenRouter returned empty content');

    if (_logContext) {
      const isTest = _logContext.is_test === true;
      LLMLog.create({
        conversation_id: _logContext.conversationId || 'unknown',
        phase: _logContext.phase || 'unknown',
        model: data.model || 'unknown',
        prompt_summary: fullPromptStr.substring(0, 500),
        response_summary: (content || '').substring(0, 500),
        token_count_in: data.usage?.prompt_tokens || 0,
        token_count_out: data.usage?.completion_tokens || 0,
        latency_ms, status: 'success', is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr, full_response: content } : {})
      }).catch((e: any) => console.error('[E18c-002] LLMLog write failed:', e.message));
    }

    if (responseSchema) {
      try { return JSON.parse(content); } catch (e) {
        console.error('[OPENROUTER] JSON parse failed:', content.substring(0, 200));
        throw new Error('OpenRouter structured output parse failed');
      }
    }

    if (returnRaw) return { content: content || '', toolCalls };

    return content;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in handleResults.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in handleResults.ts:`, err.message);
    const latency_ms = Date.now() - startTime;
    const isNetworkError = !err.message?.startsWith('OpenRouter API error:') && err.message !== 'OpenRouter returned empty content' && err.message !== 'OpenRouter structured output parse failed';
    if (isNetworkError && _logContext) {
      const isTest = _logContext.is_test === true;
      LLMLog.create({
        conversation_id: _logContext.conversationId || 'unknown',
        phase: _logContext.phase || 'unknown',
        model: 'unknown',
        prompt_summary: fullPromptStr.substring(0, 500),
        response_summary: '',
        token_count_in: 0, token_count_out: 0, latency_ms,
        status: 'timeout', is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr } : {}),
        error_message: err.message?.substring(0, 300)
      }).catch((e: any) => console.error('[E18c-002] LLMLog write failed:', e.message));
    }
    throw err;
  }
}

// =============================================================================
// ACTION_TOOL_SCHEMA
// =============================================================================
const ACTION_TOOL_SCHEMA = [{ type: 'function', function: { name: 'execute_ui_action', description: 'Execute UI actions alongside your text response when the user wants to add schools to shortlist, open panels, expand school details, filter results, edit criteria, load more schools, or sort results', parameters: { type: 'object', properties: { actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL', 'INITIATE_TOUR', 'EDIT_CRITERIA', 'FILTER_SCHOOLS', 'LOAD_MORE', 'SORT_SCHOOLS'] }, schoolId: { type: 'string' }, panel: { type: 'string', enum: ['shortlist', 'comparison', 'brief'] }, profileDelta: { type: 'object' }, filters: { type: 'object', properties: { boardingType: { type: 'string', enum: ['boarding', 'day', 'both'] }, curriculum: { type: 'string' }, gender: { type: 'string', enum: ['boys', 'girls', 'coed'] }, religiousAffiliation: { type: 'string' }, clear: { type: 'boolean' } } }, sortBy: { type: 'string', enum: ['distance', 'tuition', 'default'] } }, required: ['type'] } } }, required: ['actions'] } } }];

// =============================================================================
// Tour Request Detection
// =============================================================================
function detectJourneySubAction(message: string): { type: string; schoolName?: string } | null {
  const TOUR_INTENT_RE = /\b(book|schedule|arrange|request|set\s*up|sign\s*up\s*for|register\s*for|plan)\b.{0,30}\b(tour|visit|open\s*house|campus\s*visit|school\s*tour|info\s*session)\b/i;
  const WANT_VISIT_RE = /\b(want\s+to|like\s+to|ready\s+to|interested\s+in)\s+(visit|tour|see|check\s*out)\b/i;
  const QUESTION_TOUR_RE = /\b(can\s+(?:we|i)|how\s+(?:do\s+i|can\s+i|how\s+to))\s+(?:book|schedule|arrange|visit|tour)\b/i;
  const isTourIntent = TOUR_INTENT_RE.test(message) || WANT_VISIT_RE.test(message) || QUESTION_TOUR_RE.test(message);
  if (!isTourIntent) return null;
  const TOUR_COMMAND_WORDS = /\b(book|schedule|arrange|request|set\s*up|sign\s*up\s*for|register\s*for|plan|want\s*to|like\s*to|ready\s*to|interested\s*in|can\s*we|can\s*i|how\s*do\s*i|how\s*to|a|an|the|at|for|tour|visit|open\s*house|campus\s*visit|school\s*tour|info\s*session|please|i|we|me|my)\b/gi;
  const stripped = message.replace(/[^a-zA-Z0-9\s'-]/g, '').replace(TOUR_COMMAND_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const schoolName = stripped.length >= 2 ? stripped : undefined;
  return { type: 'INITIATE_TOUR', schoolName };
}

// =============================================================================
// MAIN: handleResultsLogic
// =============================================================================
export async function handleResultsLogic(params: any) {
  const {
    message,
    conversationFamilyProfile: rawProfile,
    context: rawContext,
    conversationHistory,
    consultantName,
    briefStatus,
    selectedSchoolId,
    conversationId,
    userId,
    userLocation,
    autoRefresh,
    extractedEntities,
    gate,
    actionHint,
    returningUserContextBlock,
    previousSchools
  } = params;

  let conversationFamilyProfile = rawProfile || {};
  let context = rawContext || {};

  // S108-WC3 Fix 3: Belt-and-suspenders fallback
  const accumulated = context.accumulatedFamilyProfile || {};
  for (const [key, value] of Object.entries(accumulated)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const existing = conversationFamilyProfile[key];
    const isEmpty = existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0);
    if (isEmpty) {
      conversationFamilyProfile[key] = value;
      console.log(`[RESULTS-S108] Backfilled from accumulatedFamilyProfile: ${key} =`, value);
    }
  }

  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE' };

  // WC10: Narrative generation removed — handled by orchestrate.ts to avoid duplicate OpenRouter calls

  // handleResults logic
  if (selectedSchoolId) {
    return {
      message: "Let me pull up that school's details for you.",
      state: 'DEEP_DIVE',
      briefStatus: briefStatus,
      schools: [],
      familyProfile: conversationFamilyProfile,
      conversationContext: { ...context, state: 'DEEP_DIVE' },
      rawToolCalls: []
    };
  }

  // FAST PATH: shortlist-action
  const shortlistFastPathRegex = /\b(add|save|shortlist|bookmark|keep)\b.{0,40}\b(school|academy|college|it|that|this|one)\b|\b(shortlist|save|add)\s+(it|that|this)\b|\badd\b.{0,30}\bto\b.{0,20}\b(shortlist|list|saved)\b/i;
  const isShortlistAction = extractedEntities?.intentSignal === 'shortlist-action' || shortlistFastPathRegex.test(message);
  if (isShortlistAction) {
    const shortlistPool = previousSchools || [];
    const matchPool = context.lastMatchedSchools || [];
    const seenIds = new Set();
    const schoolPool = [...shortlistPool, ...matchPool].filter((s: any) => { if (seenIds.has(s.id)) return false; seenIds.add(s.id); return true; });

    const msgNorm = message.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const strippedMsg = msgNorm.replace(/\b(add|save|shortlist|bookmark|keep|put|please|can you|i want to|to my|my|to the|the|shortlist|list|saved)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const msgWords = strippedMsg.split(' ').filter((w: string) => w.length > 2);
    console.log(`[SHORTLIST-FAST-PATH] Pool size: ${schoolPool.length}, msgWords=${JSON.stringify(msgWords)}`);

    const significantMsgWords = msgWords.filter((w: string) => w.length >= 4);
    const requiredScore = significantMsgWords.length > 0 ? significantMsgWords.length : 1;
    let bestMatch: any = null;
    let bestScore = 0;
    for (const s of schoolPool) {
      const nameNorm = s.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const nameWords = nameNorm.split(' ').filter((w: string) => w.length > 2);
      const overlapCount = significantMsgWords.length > 0
        ? significantMsgWords.filter((w: string) => nameWords.includes(w)).length
        : msgWords.filter((w: string) => nameWords.includes(w)).length;
      if (overlapCount > bestScore) { bestScore = overlapCount; bestMatch = s; }
    }

    let matched = bestScore >= requiredScore ? bestMatch : null;

    if (matched) {
      console.log(`[SHORTLIST-FAST-PATH] Best match: "${matched.name}" (${matched.id}) score=${bestScore}`);
      return {
        message: `Done — ${matched.name} has been added to your shortlist.`,
        state: STATES.RESULTS,
        briefStatus: briefStatus,
        schools: schoolPool,
        familyProfile: conversationFamilyProfile,
        conversationContext: context,
        actions: [{ type: 'ADD_TO_SHORTLIST', payload: { schoolId: matched.id }, timing: 'immediate' }]
      };
    }
    console.log('[SHORTLIST-FAST-PATH] No school match found in pool — falling through to search');
  }

  const journeySubAction = detectJourneySubAction(message);
  if (journeySubAction) {
    const jShortlistPool = previousSchools || [];
    const jMatchPool = context.lastMatchedSchools || [];
    const jSeenIds = new Set();
    const jSchoolPool = [...jShortlistPool, ...jMatchPool].filter((s: any) => { if (jSeenIds.has(s.id)) return false; jSeenIds.add(s.id); return true; });
    let jMatched: any = null;
    if (journeySubAction.schoolName) {
      const jMsgNorm = journeySubAction.schoolName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const jMsgWords = jMsgNorm.split(' ').filter((w: string) => w.length > 2);
      const jSignificantWords = jMsgWords.filter((w: string) => w.length >= 4);
      const jRequiredScore = jSignificantWords.length > 0 ? jSignificantWords.length : 1;
      let jBestMatch: any = null; let jBestScore = 0;
      for (const s of jSchoolPool) {
        const nameNorm = s.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const nameWords = nameNorm.split(' ').filter((w: string) => w.length > 2);
        const overlapCount = jSignificantWords.length > 0 ? jSignificantWords.filter((w: string) => nameWords.includes(w)).length : jMsgWords.filter((w: string) => nameWords.includes(w)).length;
        if (overlapCount > jBestScore) { jBestScore = overlapCount; jBestMatch = s; }
      }
      jMatched = jBestScore >= jRequiredScore ? jBestMatch : null;
    }
    if (jMatched) {
      console.log(`[TOUR-FAST-PATH] Matched "${jMatched.name}" (${jMatched.id})`);
      // Fire-and-forget TourRequest creation
      if (userId && conversationId) {
        TourRequest.create({
          parent_user_id: userId,
          school_id: jMatched.id,
          requested_at: new Date().toISOString(),
          status: 'pending',
          tour_type: 'in_person',
          message: `Tour request initiated from RESULTS state for ${jMatched.name}`,
          conversation_id: conversationId,
          child_grade: conversationFamilyProfile?.childGrade || undefined,
        }).catch((err: any) => console.error('[E29-005-AC7] TourRequest creation failed:', err?.message));
      }
      return { message: `Great choice! Let me pull up the tour request form for ${jMatched.name}.`, state: STATES.RESULTS, briefStatus: briefStatus, schools: jSchoolPool, familyProfile: conversationFamilyProfile, conversationContext: context, actions: [{ type: 'INITIATE_TOUR', payload: { schoolId: jMatched.id }, timing: 'immediate' }] };
    }
    console.log('[TOUR-FAST-PATH] No school match — falling through to LLM');
  }

  console.log('[SEARCH] Running fresh school search in RESULTS state');

  if (!conversationFamilyProfile || typeof conversationFamilyProfile !== 'object') {
    return { message: "I need a bit more information to find the right schools. Could you remind me — where are you looking and what grade?", state: STATES.RESULTS, briefStatus, schools: [], familyProfile: conversationFamilyProfile || {}, conversationContext: context, rawToolCalls: [] };
  }

  if (!conversationFamilyProfile?.locationArea && context.extractedEntities?.locationArea) {
    conversationFamilyProfile.locationArea = context.extractedEntities.locationArea;
  }

  if (!conversationFamilyProfile?.locationArea && !conversationFamilyProfile?.childGrade) {
    return { message: "I need to know your location and your child's grade to search for schools. Could you tell me both?", state: STATES.RESULTS, briefStatus, schools: [], familyProfile: conversationFamilyProfile, conversationContext: context, rawToolCalls: [] };
  }

  let parsedGrade: number | null = null;
  const rawGrade = conversationFamilyProfile?.childGrade;
  if (rawGrade !== null && rawGrade !== undefined) {
    parsedGrade = typeof rawGrade === 'number' ? rawGrade : parseInt(rawGrade);
  }

  let parsedTuition: number | null = null;
  if (conversationFamilyProfile?.maxTuition) {
    parsedTuition = typeof conversationFamilyProfile.maxTuition === 'number' ? conversationFamilyProfile.maxTuition : parseInt(conversationFamilyProfile.maxTuition);
  }

  const locationCoords = resolveLocationCoords(conversationFamilyProfile?.locationArea);
  const resolvedLat = locationCoords?.lat ?? userLocation?.lat ?? null;
  const resolvedLng = locationCoords?.lng ?? userLocation?.lng ?? null;

  const searchParams: any = { limit: 50, familyProfile: conversationFamilyProfile };

  if (conversationFamilyProfile?.locationArea) {
    const locationAreaLower = conversationFamilyProfile.locationArea.toLowerCase().trim();
    const regionAliases = ['gta', 'greater toronto area', 'lower mainland', 'metro vancouver', 'greater vancouver', 'toronto'];
    const metroRegions = ['toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton', 'winnipeg', 'hamilton'];

    if (metroRegions.includes(locationAreaLower)) {
      searchParams.region = conversationFamilyProfile.locationArea;
    } else if (regionAliases.includes(locationAreaLower)) {
      searchParams.region = conversationFamilyProfile.locationArea;
    } else {
      const cityToProvinceMap: Record<string, string> = { 'toronto': 'Ontario', 'vancouver': 'British Columbia', 'calgary': 'Alberta', 'edmonton': 'Alberta', 'montreal': 'Quebec', 'ottawa': 'Ontario', 'winnipeg': 'Manitoba', 'halifax': 'Nova Scotia', 'victoria': 'British Columbia', 'quebec city': 'Quebec', 'saskatoon': 'Saskatchewan', 'regina': 'Saskatchewan' };
      const locationParts = conversationFamilyProfile.locationArea.split(',').map((s: string) => s.trim());
      if (locationParts.length >= 2) {
        searchParams.city = locationParts[0];
        searchParams.provinceState = locationParts[1];
      } else if (locationParts.length === 1) {
        searchParams.city = locationParts[0];
        const inferredProvince = cityToProvinceMap[locationParts[0].toLowerCase()];
        if (inferredProvince) searchParams.provinceState = inferredProvince;
      }
    }

    if (!searchParams.city && !searchParams.region && locationAreaLower) {
      searchParams.city = conversationFamilyProfile.locationArea;
    }
  }

  if (resolvedLat && resolvedLng) {
    searchParams.resolvedLat = resolvedLat;
    searchParams.resolvedLng = resolvedLng;
    searchParams.maxDistanceKm = conversationFamilyProfile?.commuteToleranceMinutes ? Math.ceil(conversationFamilyProfile.commuteToleranceMinutes / 2) : 75;
  }

  if (parsedGrade !== null) { searchParams.minGrade = parsedGrade; searchParams.maxGrade = parsedGrade; }
  if (parsedTuition && parsedTuition !== (('unlimited' as unknown) as number)) { searchParams.maxTuition = parsedTuition; }

  let schools: any[] = [];
  try {
    const searchResult: any = await searchSchoolsLogic({ ...searchParams, conversationId, userId, searchQuery: message });
    schools = searchResult.schools || [];
    if (!Array.isArray(schools)) schools = [];
  } catch (e: any) {
    console.error('[ERROR] searchSchools failed:', e.message);
    return { message: "I'm having trouble searching for schools right now. Could you tell me a bit more about your preferences?", state: STATES.RESULTS, briefStatus, schools: [], familyProfile: conversationFamilyProfile, conversationContext: context, rawToolCalls: [] };
  }

  const preFilterCount = schools.length;
  schools = schools.filter((s: any) => s.school_type_label !== 'Special Needs' && s.school_type_label !== 'Public');
  console.log(`[FILTER STAGE] handleResults post-search type filter: ${preFilterCount} → ${schools.length} (removed Special Needs/Public)`);
  const seen = new Set();
  const deduplicated: any[] = [];
  for (const school of schools) { if (!seen.has(school.name)) { seen.add(school.name); deduplicated.push(school); } }
  const matchingSchools = deduplicated.slice(0, 20);
  context.state = STATES.RESULTS;

  let aiMessage = '';
  const rawToolCalls: any[] = [];

  if (!matchingSchools || matchingSchools.length === 0) {
    aiMessage = "I don't have any schools matching your criteria yet. Try a nearby city or broader criteria.";
  } else {
    try {
      const history = conversationHistory || [];
      const recentMessages = history.slice(-10);
      const conversationSummary = recentMessages.map((msg: any) => `${msg.role === 'user' ? 'Parent' : 'Consultant'}: ${msg.content}`).join('\n');

      const schoolContext = `\n\nSCHOOLS (${matchingSchools.length}):\n` +
        matchingSchools.map((s: any) => { const tuitionStr = s.tuition ? `$${s.tuition}` : 'N/A'; return `${s.name} | ${s.city} | Grade ${s.lowest_grade}-${s.highest_grade} | Tuition: ${tuitionStr}`; }).join('\n');

      const schoolCount = matchingSchools.length;
      const isFirstResults = !autoRefresh && conversationHistory?.filter((m: any) => m.role === 'assistant' && m.content?.includes('school')).length === 0;
      const isThinResults = schoolCount < 5 && schoolCount > 0;

      const autoRefreshEntitiesStr = Object.keys(extractedEntities || {}).filter(k => !['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers', 'gender'].includes(k)).join(', ');

      // T-RES-007: Consultant Narration — PRESENTATION CONTEXTS
      let narrateInstruction = '';
      if (autoRefresh && autoRefreshEntitiesStr) {
        narrateInstruction = `PRESENTATION CONTEXT — AUTO-REFRESH: New information was just extracted (${autoRefreshEntitiesStr}). The matches have ALREADY been silently updated. Regardless of the intent classified in STEP 1, ALSO open with ONE natural sentence acknowledging the update. E.g. "I've refreshed your matches based on the STEM interest — here's what changed." Do NOT ask "Does that look right?". Max 150 words total.`;
      } else if (isThinResults) {
        narrateInstruction = `PRESENTATION CONTEXT — THIN RESULTS: Only ${schoolCount} school${schoolCount === 1 ? '' : 's'} matched. Regardless of the intent classified in STEP 1, ALSO open with: "I found ${schoolCount} school${schoolCount === 1 ? '' : 's'} that fit your criteria — want me to widen the search?" Then respond per your intent classification. Max 100 words total.`;
      } else if (isFirstResults) {
        narrateInstruction = `PRESENTATION CONTEXT — INITIAL RESULTS: This is the first time showing results. Regardless of the intent classified in STEP 1, ALSO open with a warm lead-in like: "Here are your strongest matches based on everything you've told me." (Jackie: warm & encouraging, Liam: direct & confident — use your voice) Briefly highlight 1-2 notable schools. End with: "Take your time browsing. When a school catches your eye, save it to your shortlist." Max 160 words total.`;
      } else {
        narrateInstruction = `PRESENTATION CONTEXT — STANDARD: Use the intent classification in STEP 1 above to determine your full response. Do not default to a generic preference acknowledgment — only use edit-criteria behavior if the parent is genuinely expressing a preference change.`;
      }

      const comparingSchoolsNote = context.comparingSchools?.length >= 2
        ? `\n\nCOMPARISON CONTEXT: The parent is currently viewing a side-by-side comparison of: ${context.comparingSchools.join(', ')}. If they ask questions about these schools, answer with that comparison context in mind.`
        : '';

      const schoolIdContext = `\nSCHOOL IDs (use these exact IDs in execute_ui_action):\n` + matchingSchools.map((s: any) => `[ID:${s.id}] ${s.name}`).join('\n');

      const resultsSystemPrompt = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}[STATE: RESULTS] You are currently showing school results to the parent.

${consultantName === 'Jackie' ? 'YOU ARE JACKIE — Warm, empathetic, experienced.' : 'YOU ARE LIAM — Direct, strategic, no-BS.'}

═══════════════════════════════════════════
STEP 1 — BINARY GATE: ACTION or CONVERSATION?
═══════════════════════════════════════════
Read the parent's message and classify it as ACTION or CONVERSATION.

ACTION — The parent wants to DO something to their results or shortlist.
Signals: "add", "save", "compare", "filter", "show only", "change my", "book a tour", "tell me more about [school]", "remove", "sort by".
→ Go to STEP 2A.

CONVERSATION — The parent is asking a question, sharing context, thinking out loud, or seeking advice. This includes ALL of the following:
  • Education questions ("What's the difference between IB and AP?", "Is Montessori good for ADHD?")
  • Finance questions ("How much does private school cost?", "Are there scholarships?")
  • Learning differences ("My son has dyslexia, what should I look for?")
  • General parenting/school advice ("Is it worth switching schools mid-year?")
  • Opinions or reactions ("That's interesting", "I'm not sure about boarding")
  • Clarifying questions ("What do you mean by faith-based?")
  • Sharing new info ("We're also considering French immersion")
→ Go to STEP 2B. Do NOT fire any execute_ui_action tools.

When in doubt, classify as CONVERSATION. Most messages are conversation.

═══════════════════════════════════════════
STEP 2A — ACTION: Sub-classify into one of 6 intents
═══════════════════════════════════════════

INTENT: shortlist → Parent wants to add/save a school. Fire execute_ui_action with ADD_TO_SHORTLIST and the school's ID. If they say "show my shortlist" or "open shortlist", fire OPEN_PANEL with panel "shortlist". You MUST provide BOTH a text response AND fire the tool. Confirm warmly in one sentence.

INTENT: compare → Parent wants to compare 2+ schools. Provide concise comparison on key dimensions relevant to this family. End with a recommendation.

INTENT: filter → Parent wants to narrow, sort, or load more results. Fire execute_ui_action with the appropriate type:
  • FILTER_SCHOOLS with filters object (boardingType, curriculum, gender, religiousAffiliation, clear)
  • SORT_SCHOOLS with sortBy field (distance, tuition, default)
  • LOAD_MORE to show additional results
Acknowledge in ONE sentence.

INTENT: edit → Parent wants to change their search criteria (location, grade, budget, priorities). Fire execute_ui_action with EDIT_CRITERIA and profileDelta containing the changed fields. Acknowledge in ONE sentence.

INTENT: journey → Parent wants to take a next step with a specific school (book tour, request info, visit, apply). Acknowledge interest and guide the next step. Keep specific.

INTENT: expand → Parent wants more detail about a specific school. For a quick question, answer in 3-5 sentences without firing a tool. For "tell me everything" or deep-dive requests, fire execute_ui_action with EXPAND_SCHOOL and the school's ID.

═══════════════════════════════════════════
STEP 2B — CONVERSATION: Answer as consultant
═══════════════════════════════════════════
Answer substantively in 3-6 sentences. You are a knowledgeable education consultant — answer freely on topics including:
  • School types, curricula, and pedagogy (IB, AP, Montessori, Waldorf, French immersion, etc.)
  • Tuition, financial aid, scholarships, and bursaries
  • Learning differences, accommodations, and special education
  • Admissions processes and timelines
  • General parenting and education advice

Connect your answer to THIS family's specific context when possible. Reference schools in the current results when relevant, but do NOT fire any execute_ui_action tools. If the parent shares new information (e.g. a new priority), acknowledge it naturally — the system will pick it up automatically.

═══════════════════════════════════════════
UNIVERSAL TONE RULES
═══════════════════════════════════════════
- 2-4 sentences max for ACTION intents. 3-6 sentences for CONVERSATION.
- Never repeat school card content. NEVER mention a "Refresh Matches" button.
- Do NOT produce numbered preference lists. Do NOT ask "Does that look right?"
- No topic is "off-topic" — if a parent asks about it, answer helpfully.

═══════════════════════════════════════════
STEP 3 — APPLY PRESENTATION CONTEXT
═══════════════════════════════════════════
${narrateInstruction}${comparingSchoolsNote}

SCHOOL DATA (use exact IDs in execute_ui_action):
${schoolIdContext}`;

      const gateHint = gate ? `\n[PRE-CLASSIFIED: gate=${gate}${actionHint ? `, actionHint=${actionHint}` : ''}]` : '';
      const resultsUserPrompt = `Parent's latest message: "${message}"${gateHint}\n\n--- REFERENCE DATA ---\nRecent chat:\n${conversationSummary}\n${schoolContext}\n\nRespond as ${consultantName}. ONE question max.`;

      // Retry narration LLM call once on timeout/failure
      let llmResult: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          llmResult = await callOpenRouter({
            systemPrompt: resultsSystemPrompt,
            userPrompt: resultsUserPrompt,
            maxTokens: 300,
            temperature: 0.7,
            tools: ACTION_TOOL_SCHEMA,
            toolChoice: 'auto',
            returnRaw: true,
            _logContext: { conversationId, phase: 'RESULTS', is_test: false }
          });
          break; // success
        } catch (retryErr: any) {
          console.warn(`[RESULTS] Narration LLM attempt ${attempt + 1} failed:`, retryErr.message);
          if (attempt === 1) throw retryErr; // re-throw on final attempt
        }
      }
      let rawContent = llmResult?.content || '';
      try { const parsed = JSON.parse(rawContent); aiMessage = parsed.message || rawContent || "Here are your matches."; } catch { aiMessage = rawContent || "Here are your matches."; }
      if (llmResult.toolCalls?.length > 0) rawToolCalls.push(...llmResult.toolCalls);

      if (!aiMessage || aiMessage === "Here are your matches.") {
        if (rawToolCalls.length > 0) {
          const actionTypes = rawToolCalls.map((tc: any) => { try { return JSON.parse(tc.function?.arguments || '{}').action; } catch { return ''; } });
          if (actionTypes.includes('ADD_TO_SHORTLIST')) aiMessage = "Done — I've added that to your shortlist.";
          else if (actionTypes.includes('OPEN_PANEL')) aiMessage = "Here you go — I've opened that for you.";
          else if (actionTypes.includes('EXPAND_SCHOOL')) aiMessage = "Let me pull up the details on that school.";
        }
      }

      if (isShortlistAction && rawToolCalls.length === 0) {
        const msgNorm = message.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const matched = matchingSchools.find((s: any) => {
          const nameNorm = s.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
          const nameWords = nameNorm.split(' ').filter((w: string) => w.length > 3);
          return nameWords.some((w: string) => msgNorm.includes(w)) || msgNorm.includes(nameNorm);
        });
        if (matched) {
          rawToolCalls.push({ id: `synthetic-shortlist-${matched.id}`, type: 'function', function: { name: 'execute_ui_action', arguments: JSON.stringify({ action: 'ADD_TO_SHORTLIST', schoolId: matched.id }) } });
          if (!aiMessage || aiMessage === "Here are your matches.") aiMessage = `Done — ${matched.name} has been added to your shortlist.`;
        }
      }
    } catch (e: any) {
      console.error('[ERROR] RESULTS response failed:', e.message);
      if (autoRefresh && Object.keys(extractedEntities || {}).filter(k => !['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers', 'gender'].includes(k)).length > 0) {
        aiMessage = "I've refreshed your matches based on the new info — here's what changed.";
      } else if (matchingSchools.length < 5 && matchingSchools.length > 0) {
        aiMessage = `I found ${matchingSchools.length} school${matchingSchools.length === 1 ? '' : 's'} that fit your criteria. Want me to adjust the search to find more options?`;
      } else {
        aiMessage = consultantName === 'Jackie' ? "Based on everything you've shared, I've put together an initial list of schools for you to explore." : "Based on your criteria, here's your initial shortlist.";
      }
    }
  }

  const existingPool = context.lastMatchedSchools || [];
  const newIds = new Set(matchingSchools.map((s: any) => s.id));
  const preserved = existingPool.filter((s: any) => !newIds.has(s.id));
  context.lastMatchedSchools = [...matchingSchools, ...preserved].slice(0, 50);

  return {
    message: aiMessage,
    state: STATES.RESULTS,
    briefStatus: 'confirmed',
    schools: matchingSchools,
    familyProfile: conversationFamilyProfile,
    conversationContext: context,
    rawToolCalls: rawToolCalls || []
  };
}

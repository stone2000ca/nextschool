// @ts-nocheck
import { FamilyProfile, ChatHistory, FamilyJourney, SchoolJourney, ConversationArtifacts, LLMLog, School } from '@/lib/entities-server'
import { extractEntitiesLogic, applyExtractionDelta } from './extractEntities'
import { handleBriefLogic } from './handleBrief'
import { handleResultsLogic } from './handleResults'
import { handleDeepDiveLogic } from './handleDeepDive'
import { processDebriefCompletion as processDebriefCompletionLogic } from './processDebriefCompletion'
import { generateProfileNarrativeLogic } from './generateProfileNarrative'
import { searchSchoolsLogic } from './searchSchools'
import { STATES, resolveGrade, resolveBudget, resolveArrayField } from './constants'
import { syncConversationState, readConversationState } from './dualWrite'
import { fetchSchoolNotes } from './fetchSchoolNotes'
import { fetchVisitContext } from './fetchVisitContext'
import { buildPromptContext, type BuildContextParams, type FamilyBrief, type SessionState, type SchoolArtifact, type ChatMessage } from '@/lib/ai/buildPromptContext'
import { detectOffTopic } from './detectOffTopic'
import { guardrailResponse } from '@/lib/ai/guardrailResponse'
import { countTokens } from '@/lib/ai/countTokens'


// Function: orchestrateConversation
// Purpose: Route chat messages through state machine (WELCOME→DISCOVERY→RESULTS→DEEP_DIVE)
// Entities: FamilyProfile, ChatHistory, FamilyJourney, SchoolJourney, ConversationArtifacts, LLMLog
// Last Modified: 2026-03-09
// Dependencies: OpenRouter API, extractEntities, handleBrief, handleResults, handleDeepDive, processDebriefCompletion
// WC-2: LLM model upgrade — google/gemini-3-flash-preview as primary model in callOpenRouter waterfall

// =============================================================================
// INLINED: callOpenRouter
// E18c-002: LLM call logging — writes LLMLog entity for every call (fire-and-forget)
// =============================================================================
async function callOpenRouter(options) {
  // callOpenRouter v1.1 -- E32-001: added tools/toolChoice/returnRaw
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.5, _logContext, tools, toolChoice, returnRaw = false } = options;
  // _logContext = { conversationId, phase, is_test } — optional, used for LLMLog only

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }
  
  const messages: Array<{role: string; content: string}> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  // Model waterfall: WC-2 upgrade — Gemini 3 Flash Preview primary, GPT-4.1-mini fallback, Gemini Flash tertiary
  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];
  
  const body: any = {
    models,
    messages,
    max_tokens: maxTokens,
    temperature
  };
  
  // E32-001: Inject tools when provided
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

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

  // E18c-002: Start timer
  const startTime = Date.now();

  const fullPromptStr = messages.map(m => `[${m.role}] ${m.content}`).join('\n');

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
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

      // E18c-002: Log error (fire-and-forget)
      if (_logContext) {
        const isTest = _logContext.is_test === true;
        LLMLog.create({
          conversation_id: _logContext.conversationId || 'unknown',
          phase: _logContext.phase || 'unknown',
          model: 'unknown',
          prompt_summary: fullPromptStr.substring(0, 500),
          response_summary: errorText.substring(0, 500),
          token_count_in: 0,
          token_count_out: 0,
          latency_ms,
          status: 'error',
          is_test: isTest,
          ...(isTest ? { full_prompt: fullPromptStr } : {}),
          error_message: `HTTP ${response.status}: ${errorText.substring(0, 300)}`
        }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
      }

      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[OPENROUTER] Response model used:', data.model, 'usage:', data.usage);
    
    const content = data.choices?.[0]?.message?.content;
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (!content && toolCalls.length === 0) throw new Error('OpenRouter returned empty content');

    // E18c-002: Log success (fire-and-forget)
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
        latency_ms,
        status: 'success',
        is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr, full_response: content } : {})
      }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
    }

    if (responseSchema) {
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error('[OPENROUTER] JSON parse failed:', content.substring(0, 200));
        throw new Error('OpenRouter structured output parse failed');
      }
    }

    // E32-001: returnRaw returns { content, toolCalls } for callers that need tool_calls
    if (returnRaw) return { content: content || '', toolCalls };
    
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in orchestrateConversation.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS/1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in orchestrateConversation.ts:`, err.message);
    const latency_ms = Date.now() - startTime;
    // Only log if not already logged above (i.e. network-level errors, not HTTP errors)
    const isNetworkError = !err.message?.startsWith('OpenRouter API error:') && err.message !== 'OpenRouter returned empty content' && err.message !== 'OpenRouter structured output parse failed';
    if (isNetworkError && _logContext) {
      const isTest = _logContext.is_test === true;
      LLMLog.create({
        conversation_id: _logContext.conversationId || 'unknown',
        phase: _logContext.phase || 'unknown',
        model: 'unknown',
        prompt_summary: fullPromptStr.substring(0, 500),
        response_summary: '',
        token_count_in: 0,
        token_count_out: 0,
        latency_ms,
        status: 'timeout',
        is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr } : {}),
        error_message: err.message?.substring(0, 300)
      }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
    }
    throw err;
  }
}

// =============================================================================
// E32-001: UI Action validation helpers
// =============================================================================
// E41-S6/S7/S10: Extended action types
const V1_ACTION_TYPES = ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL', 'INITIATE_TOUR', 'EDIT_CRITERIA', 'FILTER_SCHOOLS', 'LOAD_MORE', 'SORT_SCHOOLS'];
const VALID_PANELS = ['shortlist', 'comparison', 'brief'];
const ACTION_TOOL_SCHEMA = [{ type: 'function', function: { name: 'execute_ui_action', description: 'Execute UI actions alongside your text response when the user wants to add schools to shortlist, open panels, expand school details, edit criteria, filter results, load more schools, or sort results', parameters: { type: 'object', properties: { actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL', 'INITIATE_TOUR', 'EDIT_CRITERIA', 'FILTER_SCHOOLS', 'LOAD_MORE', 'SORT_SCHOOLS'] }, schoolId: { type: 'string', description: 'School entity ID (for ADD_TO_SHORTLIST, EXPAND_SCHOOL)' }, panel: { type: 'string', enum: ['shortlist', 'comparison', 'brief'] }, profileDelta: { type: 'object', description: 'Profile fields to update for EDIT_CRITERIA (e.g. { max_tuition: 25000 })' }, filters: { type: 'object', description: 'Filter overrides for FILTER_SCHOOLS', properties: { boardingType: { type: 'string', enum: ['boarding', 'day', 'both'] }, curriculum: { type: 'string' }, gender: { type: 'string', enum: ['boys', 'girls', 'coed'] }, religiousAffiliation: { type: 'string' }, clear: { type: 'boolean' } } }, sortBy: { type: 'string', enum: ['distance', 'tuition', 'default'], description: 'Sort field for SORT_SCHOOLS' } }, required: ['type'] } } }, required: ['actions'] } } }];

// =============================================================================
// E41-S2: Inline classifyIntent — regex keyword gate, no LLM (~5-50ms)
// Mirrors functions/classifyIntent.ts — inlined because Deno functions can't import across files.
// =============================================================================
const CLASSIFY_INTENT_ACTION_PATTERNS: Array<{ hint: string; re: RegExp }> = [
  { hint: 'shortlist',   re: /\b(add|shortlist|save|bookmark|keep)\b/i },
  { hint: 'compare',     re: /\b(compare|versus|vs\.?|side[\s-]by[\s-]side)\b|difference between .+ and /i },
  { hint: 'filter',      re: /\b(filter|only show|hide|just .+ schools?)\b/i },
  { hint: 'edit',        re: /\b(change .+ to|budget .+ (is|now)|actually .+ not|update my|new budget|budget is now|budget changed)\b/i },
  { hint: 'journey',     re: /\b(book .+ tour|schedule .+ (tour|visit)|apply|open house|campus visit)\b/i },
  { hint: 'expand',      re: /\b(deep dive|tell me everything|full (report|analysis|profile))\b/i },
  { hint: 'load-more',   re: /\b(show more|load more|more schools?|see more)\b/i },
  { hint: 'sort',        re: /\b(sort by|closest first|sort (by )?distance|sort (by )?tuition|order by)\b/i },
  { hint: 'open-panel',  re: /\b(open (my )?(shortlist|brief|comparison)|show (my )?(shortlist|brief))\b/i },
];
function classifyIntentFn(message: string): { gate: 'ACTION' | 'ACTION_ADJACENT' | 'TASK_DRIVEN' | 'CLARIFICATION' | 'OFF_TOPIC' | 'CONVERSATION'; actionHint?: string } {
  if (!message || message.trim().length === 0) return { gate: 'CONVERSATION' };
  for (const { hint, re } of CLASSIFY_INTENT_ACTION_PATTERNS) {
    if (re.test(message)) return { gate: 'ACTION', actionHint: hint };
  }
  // E52-B2: Check off-topic regex blocklist (mirrors classifyIntent.ts gate 2)
  if (detectOffTopic(message.trim())) return { gate: 'OFF_TOPIC' };
  // Generous default (E52-B1): treat ambiguous messages as potentially task-related
  return { gate: 'TASK_DRIVEN' };
}

function validateActions(rawToolCalls, validSchoolIds, conversationId) {
  const validatedActions: any[] = [];
  if (!rawToolCalls || !Array.isArray(rawToolCalls)) return validatedActions;
  for (const tc of rawToolCalls) {
    try {
      const args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments;
      if (!args?.actions || !Array.isArray(args.actions)) continue;
      for (const action of args.actions) {
        if (!V1_ACTION_TYPES.includes(action.type)) { logDroppedAction( conversationId, action, 'INVALID_TYPE'); continue; }
        if ((action.type === 'ADD_TO_SHORTLIST' || action.type === 'EXPAND_SCHOOL') && !validSchoolIds.has(action.schoolId)) { logDroppedAction( conversationId, action, 'INVALID_SCHOOL_ID'); continue; }
        if (action.type === 'OPEN_PANEL' && !VALID_PANELS.includes(action.panel)) { logDroppedAction( conversationId, action, 'INVALID_PANEL'); continue; }
        const timing = action.type === 'ADD_TO_SHORTLIST' ? 'immediate' : 'after_message';
        // E41: Build payload for extended action types
        let payload: Record<string, unknown> = { schoolId: action.schoolId };
        if (action.type === 'OPEN_PANEL') payload = { panel: action.panel };
        else if (action.type === 'EDIT_CRITERIA') payload = { profileDelta: action.profileDelta || {} };
        else if (action.type === 'FILTER_SCHOOLS') payload = { filters: action.filters || {} };
        else if (action.type === 'SORT_SCHOOLS') payload = { sortBy: action.sortBy || 'default' };
        else if (action.type === 'LOAD_MORE') payload = {};
        validatedActions.push({ type: action.type, payload, timing });
      }
    } catch (e) { logDroppedAction( conversationId, tc, 'PARSE_ERROR'); }
  }
  return validatedActions;
}

async function logDroppedAction( conversationId, action, reason) {
  try { await LLMLog.create({ conversation_id: conversationId || 'unknown', phase: 'ACTION_VALIDATION', status: 'ACTION_DROPPED', prompt_summary: JSON.stringify(action).substring(0, 100), response_summary: reason }); } catch (e) { console.error('[E32] Failed to log dropped action:', e.message); }
}

// =============================================================================
// INLINED: resolveTransition
// =============================================================================
function resolveTransition(params) {
  let { currentState, intentSignal, profileData, turnCount, briefEditCount, selectedSchoolId, previousSchoolId, userMessage, tier1CompletedTurn: storedTier1CompletedTurn, context } = params;

  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE', JOURNEY_RESUMPTION: 'JOURNEY_RESUMPTION' };

  // Patch 3: Invalid state reset — prevents unknown states from bricking conversations
  // Also catches legacy BRIEF state from older conversations
  if (currentState && !Object.values(STATES).includes(currentState)) {
    console.warn('[RESOLVE] Unknown/legacy state detected, resetting to DISCOVERY:', currentState);
    currentState = STATES.DISCOVERY;
  }

  const hasLocation = !!(profileData?.location_area);
  const hasGrade = profileData?.child_grade !== null && profileData?.child_grade !== undefined;
  const hasBudget = !!(profileData?.max_tuition);
  const prioritiesCount = profileData?.priorities?.length || 0;
  
  let sufficiency = 'THIN';
  if (hasLocation && hasGrade) {
    sufficiency = prioritiesCount >= 2 ? 'RICH' : 'MINIMUM';
  }

  const flags: Record<string, any> = { FORCED_TRANSITION: false, USER_INTENT_OVERRIDE: false };
  let nextState = currentState;
  let transitionReason = 'natural';

  // Dynamic cap tracking: store turn when Tier 1 first became complete
  const tier1Complete = hasGrade && hasLocation && hasBudget;
  let tier1CompletedTurn = storedTier1CompletedTurn || null;
  if (tier1Complete && tier1CompletedTurn === null) {
    tier1CompletedTurn = turnCount;
    flags.tier1CompletedTurn = tier1CompletedTurn;
  }

  console.log('[RESOLVE] Input:', { currentState, intentSignal, sufficiency, turnCount, briefEditCount, selectedSchoolId });
  console.log('[DEBUG-BRIEF] briefStatus:', params.briefStatus, 'userMessage:', userMessage);

  // BUG-FLOW-001 HARD GUARD: RESULTS and DEEPDIVE can NEVER regress to BRIEF or DISCOVERY.
  const inResultsOrDeepDive = currentState === STATES.RESULTS || currentState === STATES.DEEP_DIVE;
  if (inResultsOrDeepDive) {
    // E13a-FIX: Ongoing debrief detection
    const hasActiveDebrief = context?.debriefSchoolId &&
      (context?.debriefQuestionQueue?.length > 0 ||
       (context?.debriefQuestionsAsked?.length > 0 &&
        context?.debriefQuestionsAsked?.length < 3));
    if (hasActiveDebrief) {
      return {
        nextState: STATES.DEEP_DIVE,
        sufficiency,
        flags: { ...flags, DEBRIEF_MODE: true },
        transitionReason: 'debrief_ongoing',
        deepDiveMode: 'debrief'
      };
    }
    // E13a: Visit debrief detection — if user mentions visiting/touring a school
    const DEBRIEF_RE = /\b(visited|toured|went to|saw the campus|open house|got back from|checked out|walked through)\b/i;
    if (DEBRIEF_RE.test(userMessage || '') || intentSignal === 'visit_debrief') {
      console.log('[E13a] Visit debrief detected');
      return { 
        nextState: STATES.DEEP_DIVE, 
        sufficiency, 
        flags: { ...flags, DEBRIEF_MODE: true }, 
        transitionReason: 'visit_debrief',
        deepDiveMode: 'debrief'
      };
    }
    
    if (currentState === STATES.RESULTS && intentSignal === 'edit-criteria') {
      console.log('[E41-S6] edit-criteria in RESULTS — staying in RESULTS for inline re-search');
      return { nextState: STATES.RESULTS, sufficiency, flags: { ...flags, USER_INTENT_OVERRIDE: true }, transitionReason: 'edit_criteria_inline' };
    }
    if (selectedSchoolId && selectedSchoolId !== previousSchoolId) {
      return { nextState: STATES.DEEP_DIVE, sufficiency, flags, transitionReason: 'school_selected' };
    }
    console.log('[HARD GUARD] Blocked regression from', currentState, '— intentSignal was:', intentSignal);
    return { nextState: currentState, sufficiency, flags, transitionReason: 'hard_guard_results_deepdive' };
  }

  // Patch 2b: JOURNEY_RESUMPTION state handler
  if (currentState === STATES.JOURNEY_RESUMPTION) {
    if (intentSignal === 'restart' || intentSignal === 'edit-criteria') {
      return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason: 'journey_resumption_restart' };
    }
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'journey_resumption_continue' };
  }

  // FIX-DD-STARTUP: Check school selection BEFORE WELCOME→DISCOVERY transition
  // so that clicking "analyze this school" always routes to DEEP_DIVE regardless of state
  if (selectedSchoolId && selectedSchoolId !== previousSchoolId) {
    return { nextState: STATES.DEEP_DIVE, sufficiency, flags, transitionReason: 'school_selected' };
  }
  if (currentState === STATES.WELCOME && turnCount > 0) {
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason: 'auto_welcome_exit' };
  }
  
  // STOP_PHRASES — user explicitly signals they're done with questions, go to RESULTS
  const STOP_PHRASES = /\b(no more questions|show me schools|i('m| am) done|enough questions|just show|stop asking|skip|let'?s see|move on|go ahead|that'?s enough|ready to see)\b/i;
  if (currentState === STATES.DISCOVERY && STOP_PHRASES.test(userMessage || '')) {
    flags.USER_INTENT_OVERRIDE = true;
    console.log('[RESOLVE] Stop-intent detected, routing to RESULTS:', userMessage);
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'stop_intent', tier1CompletedTurn };
  }

  // Explicit request for results from DISCOVERY
  if ((intentSignal === 'request-brief' || intentSignal === 'request-results') && currentState === STATES.DISCOVERY) {
    if (sufficiency === 'MINIMUM' || sufficiency === 'RICH') {
      flags.USER_INTENT_OVERRIDE = true;
      return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'explicit_demand' };
    }
  }
  // Auto-transition from DISCOVERY to RESULTS when enough info gathered
  if (currentState === STATES.DISCOVERY) {
    if (tier1Complete && tier1CompletedTurn !== null && turnCount >= (tier1CompletedTurn + 1)) {
      flags.FORCED_TRANSITION = true;
      return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'enrichment_cap', tier1CompletedTurn };
    } else if (turnCount >= 10) {
      flags.FORCED_TRANSITION = true;
      return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'hard_cap', tier1CompletedTurn };
    }
  }
  if (intentSignal === 'edit-criteria') {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'explicit_intent' };
  }
  if (intentSignal === 'back-to-results') {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'explicit_intent', clearSelectedSchool: true };
  }
  if (intentSignal === 'restart') {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason: 'explicit_intent' };
  }
  if (currentState === STATES.DISCOVERY && intentSignal === 'continue') {
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason };
  }
  if (intentSignal === 'off-topic') {
    return { nextState: currentState, sufficiency, flags, transitionReason };
  }
  return { nextState: currentState, sufficiency, flags, transitionReason };
}



// =============================================================================
// S113-WC2: mergeProfile — safe field merge that never overwrites arrays with empty
// =============================================================================
function mergeProfile(base, incoming) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;
    const existing = merged[key];
    if (Array.isArray(value)) {
      if (Array.isArray(existing) && existing.length > 0) {
        if (value.length === 0) continue;
        merged[key] = [...new Set([...existing, ...value])];
      } else {
        merged[key] = value;
      }
    } else {
      if (value !== '') merged[key] = value;
    }
  }
  return merged;
}

// =============================================================================
// LIGHTWEIGHT REGEX EXTRACTION — zero LLM calls, <5ms execution
// =============================================================================
function lightweightExtract(message, existingProfile) {
  const bridgeProfile: Record<string, any> = {};
  let bridgeIntent = 'continue';

  // Grade extraction: "grade 9", "going into grade 9", "9th grade", "kindergarten", "JK", "SK"
  const gradeMatch = message.match(/(?:going\s+)?(?:into\s+)?(?:grade|gr\.?)\s+([0-9]+|pk|jk|sk|k|kindergarten|junior|senior)/i);
  if (gradeMatch) {
    const gradeStr = gradeMatch[1].toLowerCase();
    const gradeMap = { 'pk': -2, 'jk': -1, 'sk': 0, 'k': 0, 'kindergarten': 0, 'junior': 11, 'senior': 12 };
    const grade = gradeMap[gradeStr] !== undefined ? gradeMap[gradeStr] : parseInt(gradeStr);
    if (!isNaN(grade)) bridgeProfile.child_grade = grade;
  }

  // Location extraction
  // S113-WC1: Location fix - curated city regex + await extractEntities at BRIEF/RESULTS
  const locMatch = message.match(/(?:live\s+)?(?:in|near|around|from)\s+([a-zA-Z\s]+?)(?:\s+(?:area|region|city|province|state)|\.|\s*$|,)/i);
  if (locMatch) {
    const loc = locMatch[1].trim();
    const NON_GEO = /\b(IB|AP|STEM|IGCSE|Montessori|Waldorf|Reggio|French|Programs?|Immersion|Curriculum|English|Math|Science|Art|Music|Drama)\b/gi;
    const cleanedLoc = loc.replace(NON_GEO, '').replace(/\s+/g, ' ').trim();
    if (cleanedLoc.length > 2 && /[A-Z]/.test(cleanedLoc)) { bridgeProfile.location_area = cleanedLoc; }
  }
  // S113-WC1: Secondary fallback — bare city name or known Canadian region (no preposition required)
  if (!bridgeProfile.location_area) {
    const KNOWN_LOCATIONS = ['Greater Toronto Area', 'GTA', 'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton', 'Mississauga', 'Oakville', 'Markham', 'Richmond Hill', 'Burlington', 'Hamilton', 'Brampton', 'Vaughan', 'Waterloo', 'Kitchener', 'London', 'Victoria'];
    for (const knownLoc of KNOWN_LOCATIONS) {
      const escaped = knownLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(message)) {
        bridgeProfile.location_area = knownLoc;
        break;
      }
    }
  }

  // Budget extraction
  const budgetMatches = message.matchAll(/(\$)\s*(\d{1,3}(?:,\d{3})*|\d+)\s*([kK])?|(\d{1,3}(?:,\d{3})*|\d+)\s*([kK])/g);
  let maxBudgetFound = 0;
  for (const match of budgetMatches) {
    let numStr, hasKilo;
    if (match[1]) {
      numStr = match[2];
      hasKilo = !!match[3];
    } else {
      numStr = match[4];
      hasKilo = !!match[5];
    }
    const num = parseInt(numStr.replace(/,/g, ''));
    if (!isNaN(num)) {
      const amount = hasKilo ? num * 1000 : num;
      if (amount >= 5000 && amount <= 500000) {
        maxBudgetFound = Math.max(maxBudgetFound, amount);
      }
    }
  }
  if (maxBudgetFound > 0) {
    bridgeProfile.max_tuition = maxBudgetFound;
  }

  // Gender extraction
  const strongGenderKw = /\b(son|daughter)\b/i.test(message);
  if (strongGenderKw || !existingProfile?.child_gender) {
    if (/\b(son|boy|he|him|his)\b/i.test(message)) { bridgeProfile.child_gender = 'male'; bridgeProfile.gender = 'male'; }
    else if (/\b(daughter|girl|she|her)\b/i.test(message)) { bridgeProfile.child_gender = 'female'; bridgeProfile.gender = 'female'; }
  }

  // S111-WC3: Child name extraction
  if (!existingProfile?.child_name) {
    const nameMatch = message.match(/\b(?:my\s+)?(?:son|daughter|child|kid)\s+(?:is\s+)?(?:named\s+)?([A-Z][a-z]{1,15})\b/) ||
                      message.match(/\b(?:named|name\s+is|call(?:ed)?)\s+([A-Z][a-z]{1,15})\b/) ||
                      message.match(/\b([A-Z][a-z]{1,15})\s+(?:is\s+)?(?:my\s+)?(?:son|daughter|child|kid)\b/) ||
                      message.match(/\b([A-Z][a-z]{1,15})\s+(?:is\s+)?(?:in\s+)?grade\s+/);
    if (nameMatch) {
      const candidateName = nameMatch[1];
      const CITY_NAMES = new Set(['Toronto', 'Vancouver', 'Ottawa', 'Montreal', 'Calgary', 'Edmonton', 'Winnipeg', 'Halifax', 'Victoria', 'London', 'Boston', 'Chicago']);
      if (!CITY_NAMES.has(candidateName)) {
        bridgeProfile.child_name = candidateName;
      }
    }
  }

  // S111-WC3: Curriculum preference extraction
  if (!existingProfile?.curriculum_preference || existingProfile.curriculum_preference.length === 0) {
    const curriculumKeywords = message.match(/\b(montessori|waldorf|reggio|IB|international\s+baccalaureate|AP|advanced\s+placement|french\s+immersion|STEM)\b/gi);
    if (curriculumKeywords) {
      const normalized = curriculumKeywords.map(k => {
        const lower = k.toLowerCase();
        if (lower === 'international baccalaureate') return 'IB';
        if (lower === 'advanced placement') return 'AP';
        if (lower === 'french immersion') return 'French Immersion';
        return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
      });
      bridgeProfile.curriculum_preference = [...new Set(normalized)];
    }
  }

  // S111-WC3: Dealbreakers extraction (negation-anchored)
  const dealbreakers: any[] = [];
  const negReligious = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?(?:religious|religion|faith[- ]based)/i;
  if (negReligious.test(message)) dealbreakers.push('religious');
  const negSingleSex = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?(?:single[- ]sex|all[- ]boys|all[- ]girls|boys[- ]only|girls[- ]only)/i;
  if (negSingleSex.test(message)) dealbreakers.push('single-sex');
  const negBoarding = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?boarding/i;
  if (negBoarding.test(message)) dealbreakers.push('boarding');
  const negUniform = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?uniform/i;
  if (negUniform.test(message)) dealbreakers.push('uniform');
  if (dealbreakers.length > 0) {
    bridgeProfile.dealbreakers = dealbreakers;
  }

  // S111-WC3: School type extraction
  if (!existingProfile?.school_type_label) {
    if (/\b(?:co-?ed|coed)\b/i.test(message)) bridgeProfile.school_type_label = 'co-ed';
    else if (/\ball[- ]?boys\b/i.test(message)) bridgeProfile.school_type_label = 'all-boys';
    else if (/\ball[- ]?girls\b/i.test(message)) bridgeProfile.school_type_label = 'all-girls';
  }

  // S111-WC3: Interests extraction (verb-anchored)
  const INTEREST_KEYWORDS = 'art|arts|music|sports|athletics|drama|theatre|theater|science|coding|robotics|swimming|hockey|soccer|basketball|dance|piano|guitar|reading|writing|math';
  const interestVerbPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+(${INTEREST_KEYWORDS})\\b`, 'gi');
  const interestListPattern = new RegExp(`\\b(?:interests?|hobbies|activities)\\s*:?\\s*((?:(?:${INTEREST_KEYWORDS})(?:\\s*,\\s*|\\s+and\\s+|\\s+))+(?:${INTEREST_KEYWORDS}))`, 'gi');
  const foundInterests = new Set();
  let iMatch;
  while ((iMatch = interestVerbPattern.exec(message)) !== null) {
    foundInterests.add(iMatch[1].toLowerCase());
  }
  const interestVerbListPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+((?:(?:${INTEREST_KEYWORDS})(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+))*(?:${INTEREST_KEYWORDS}))`, 'gi');
  while ((iMatch = interestVerbListPattern.exec(message)) !== null) {
    const items = iMatch[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  while ((iMatch = interestListPattern.exec(message)) !== null) {
    const items = iMatch[1].split(/\s*,\s*|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  const interestCommaPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+(.+?)(?:[.!?]|$)`, 'gi');
  let cMatch;
  while ((cMatch = interestCommaPattern.exec(message)) !== null) {
    const items = cMatch[1].split(/\s*,\s*|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  if (foundInterests.size > 0) {
    bridgeProfile.interests = Array.from(foundInterests);
  }

  // Intent detection
  if (/\b(brief|summary|that'?s all|that'?s it)\b/i.test(message)) bridgeIntent = 'request-brief';
  else if (/\b(that looks right|show me schools|looks good|looks right|confirmed?|yes please)\b/i.test(message)) bridgeIntent = 'confirm-brief';

  return { bridgeProfile, bridgeIntent };
}

// =============================================================================
// INLINED: handleDiscovery
// =============================================================================
async function handleDiscovery(message, conversationFamilyProfile, context, conversationHistory, consultantName, currentSchools, flags, returningUserContextBlock) {
  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE' };

  const hasGrade = conversationFamilyProfile?.child_grade !== null && conversationFamilyProfile?.child_grade !== undefined;
  const hasLocation = !!conversationFamilyProfile?.location_area;
  const hasBudget = !!conversationFamilyProfile?.max_tuition;
  const hasGender = !!conversationFamilyProfile?.gender;

  const knownFacts: any[] = [];
   if (hasGrade) knownFacts.push(`grade ${conversationFamilyProfile.child_grade}`);
   if (hasGender) knownFacts.push(`${conversationFamilyProfile.gender}`);
   if (hasLocation) knownFacts.push(`location: ${conversationFamilyProfile.location_area}`);
   if (hasBudget) knownFacts.push(`budget: $${conversationFamilyProfile.max_tuition}`);
   if (conversationFamilyProfile?.interests?.length > 0) knownFacts.push(`interests: ${conversationFamilyProfile.interests.join(', ')}`);
   if (conversationFamilyProfile?.priorities?.length > 0) knownFacts.push(`priorities: ${conversationFamilyProfile.priorities.join(', ')}`);
   if (conversationFamilyProfile?.dealbreakers?.length > 0) knownFacts.push(`dealbreakers: ${conversationFamilyProfile.dealbreakers.join(', ')}`);
   if (conversationFamilyProfile?.curriculum_preference?.length > 0) knownFacts.push(`curriculum: ${conversationFamilyProfile.curriculum_preference.join(', ')}`);
   if (conversationFamilyProfile?.child_name) knownFacts.push(`child name: ${conversationFamilyProfile.child_name}`);
   const knownSummary = knownFacts.length > 0
     ? `\nALREADY COLLECTED (DO NOT ASK AGAIN): ${knownFacts.join(', ')}.`
     : '';

  let tier1Guidance = '';
  const missingFields: any[] = [];
  if (!hasGrade) missingFields.push('grade/age');
  if (!hasGender) missingFields.push('gender (son or daughter)');
  if (!hasLocation) missingFields.push('location/area');
  if (!hasBudget) missingFields.push('tuition budget');

  if (missingFields.length >= 3) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields.join(', ')}. Ask about the two most important ones in your first response. After that, ask one at a time. Budget is always annual tuition. Do NOT ask to confirm if it is per year or per month. Accept the number as-is.`;
  } else if (missingFields.length === 2) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields.join(' and ')}. If this is your first response, you may ask about both. Otherwise, pick the most important one. Budget is always annual tuition. Accept the number as-is.`;
  } else if (missingFields.length === 1) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields[0]}. Work this in naturally.`;
  }

  // E52-A4: Build persona instructions (phase-specific, used as systemInstructions for buildPromptContext)
  const personaCore = `[STATE: DISCOVERY] You are gathering family info to find the right school. Your primary goal is to collect Tier 1 data: child's grade/age, preferred location, and budget — in that priority order.
${knownSummary}
${tier1Guidance}
TURN MANAGEMENT: Transition to RESULTS within 5 turns maximum. If Tier 1 (grade, location, budget) is complete, do not exceed 1 enrichment turn — move to RESULTS on the next turn.
DUPLICATE QUESTION GUARD: Before asking any question, check the ALREADY COLLECTED list above. Never ask about a field that already has a value. If all Tier 1 fields are filled, do not ask about them again under any circumstances.
On your FIRST response only, you may ask about two related things together (e.g., grade and location). After the first turn, ask exactly ONE question per turn. Never ask more than one question after the first turn. Always answer their question first, then ask yours. Do NOT recommend schools or mention school names. CRITICAL FORMAT RULE: Your response must be MAX 2 sentences. Be conversational and warm, not robotic.
CRITICAL: Do NOT generate a brief, summary, or any bullet-point summary of the family's needs. You are ONLY asking questions right now. Do NOT interrupt emotional or contextual sharing — allow organic conversation flow. Keep gathering information.
CRITICAL: NEVER ask the user to confirm or repeat information they have already provided in this conversation. If they said their daughter is in grade 9, do not ask what grade again.
NEVER repeat a question verbatim that the user ignored or didn't answer. If they skip a question, either rephrase it completely or move on to the next priority. Never make the conversation feel like a form.`;

  const personaTail = consultantName === 'Jackie'
    ? 'YOU ARE JACKIE - Senior education consultant, 10+ years placing families in private schools. You\'re warm but efficient.'
    : 'YOU ARE LIAM - Senior education strategist, 10+ years in private school placement. You\'re direct and data-driven.';

  const personaInstructions = (returningUserContextBlock ? returningUserContextBlock + '\n\n' : '') + personaCore + '\n' + personaTail;

  // E52-A4: Map profile → FamilyBrief for buildPromptContext
  const discoveryFamilyBrief: FamilyBrief = {
    childName: conversationFamilyProfile?.child_name || undefined,
    grade: conversationFamilyProfile?.child_grade ?? undefined,
    location: conversationFamilyProfile?.location_area || undefined,
    budget: conversationFamilyProfile?.max_tuition || undefined,
    priorities: conversationFamilyProfile?.priorities || undefined,
    dealbreakers: conversationFamilyProfile?.dealbreakers || undefined,
    schoolTypePreferences: conversationFamilyProfile?.curriculum_preference || undefined,
  };

  const discoverySessionState: SessionState = {
    currentState: 'DISCOVERY',
    consultantName: consultantName || undefined,
    turnCount: (conversationHistory?.filter(m => m.role === 'user').length || 0) + 1,
  };

  // E52-A4: Map currentSchools to SchoolRef[] for school resolution
  const knownSchoolRefs = (currentSchools || []).map(s => ({ id: s.id, name: s.name }));

  // E52-A4: Assemble token-budgeted context via buildPromptContext
  const promptCtx = await buildPromptContext({
    userMessage: message,
    systemInstructions: personaInstructions,
    familyBrief: discoveryFamilyBrief,
    sessionState: discoverySessionState,
    conversationHistory: (conversationHistory || []).map(m => ({ role: m.role, content: m.content })),
    conversationId: context.conversationId || undefined,
    knownSchools: knownSchoolRefs,
  });
  console.log(`[E52-A4] DISCOVERY buildPromptContext: ${promptCtx.totalTokens} tokens, trimmed=${promptCtx.trimmed}${promptCtx.trimmed ? ` (${promptCtx.trimActions.join(', ')})` : ''}`);

  const discoveryUserPrompt = `Parent: "${message}"\n\nRespond as ${consultantName}. 1 question (2 allowed on first turn only). No filler.`;

  let discoveryMessageRaw = 'Tell me more about your child.';
  try {
    discoveryMessageRaw = await callOpenRouter({
      systemPrompt: promptCtx.context,
      userPrompt: discoveryUserPrompt,
      maxTokens: 300,
      temperature: 0.7,
      _logContext: { conversationId: context.conversationId || 'unknown', phase: 'DISCOVERY', is_test: false }
    });
    console.log('[DISCOVERY] Response via callOpenRouter (primary)');
  } catch (openRouterError) {
    console.log('[DISCOVERY] callOpenRouter failed, falling back to InvokeLLM with 8s timeout');
    try {
      const invokeResult = await Promise.race([
        callOpenRouter({
          prompt: promptCtx.context + '\n\nParent: "' + message + '"\n\nRespond as ' + consultantName + '. 2-3 questions max. No filler.',
          model: 'gpt_5_mini',
          maxTokens: 200
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 8s')), 8000))
      ]);
      discoveryMessageRaw = invokeResult?.response || invokeResult || 'Tell me more about your child.';
      console.log('[DISCOVERY] Response via InvokeLLM (fallback)');
    } catch (invokeLLMError) {
      console.error('[DISCOVERY] Both LLM providers failed:', invokeLLMError.message);
    }
  }
  
  if (currentSchools && currentSchools.length > 0) {
    const sentences = discoveryMessageRaw.split(/(?<=[.!?])\s+/);
    const filteredSentences = sentences.filter(sentence => {
      for (const school of currentSchools) {
        const escapedName = school.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        if (regex.test(sentence)) return false;
      }
      return true;
    });
    discoveryMessageRaw = filteredSentences.join(' ').trim();
  }

  return {
    message: discoveryMessageRaw,
    state: STATES.DISCOVERY,
    briefStatus: null,
    familyProfile: conversationFamilyProfile,
    conversationContext: context,
    schools: []
  };
}

// =============================================================================
// INLINED: handleVisitDebrief
// =============================================================================
async function handleVisitDebriefInternal(selectedSchoolId, processMessage, conversationFamilyProfile, context, consultantName, returningUserContextBlock, callOpenRouter) {
   if (!selectedSchoolId) return null;
   // NOTE: conversationId may be missing; artifact lookups will be guarded
  
  try {
    console.log('[E13a] Debrief mode active for school:', selectedSchoolId);
    
    // Load school and prior analysis (including deep_dive_analysis for fit re-evaluation)
    const schoolResults = await School.filter({ id: selectedSchoolId });
    let artifacts: any[] = [];
    let deepDiveArtifacts: any[] = [];
    if (context?.conversationId) {
      [artifacts, deepDiveArtifacts] = await Promise.all([
        ConversationArtifacts.filter({
          conversation_id: context.conversationId,
          school_id: selectedSchoolId,
          artifact_type: 'visit_prep'
        }),
        ConversationArtifacts.filter({
          conversation_id: context.conversationId,
          school_id: selectedSchoolId,
          artifact_type: 'deep_dive_analysis'
        })
      ]);
    }
    const school = schoolResults?.[0];
    const priorAnalysis = artifacts?.[0];
    const deepDiveAnalysis = deepDiveArtifacts?.[0];
    
    if (!school) return null;
    
    const schoolName = school.name;
    const childName = conversationFamilyProfile?.child_name || 'your child';
    const priorVisitQuestions = priorAnalysis?.content?.visit_questions || priorAnalysis?.content?.visitQuestions || [];
    const priorTradeOffs = priorAnalysis?.content?.trade_offs || priorAnalysis?.content?.tradeOffs || [];
    
    // WC9: Initialize or refresh debrief question queue if switching schools
    const isNewDebrief = context.debriefSchoolId !== selectedSchoolId;
    let debriefQuestionQueue = context.debriefQuestionQueue || [];
    let debriefQuestionsAsked = context.debriefQuestionsAsked || [];
    
    const alreadyComplete = !isNewDebrief && debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length >= 3;
    if (alreadyComplete) {
      console.log('[E13a] Debrief already complete for this school, producing wrap-up');
      return {
        message: `Thank you for sharing your thoughts on ${school.name}. Your visit feedback has been noted and will help refine your school recommendations. Is there anything else you'd like to explore?`,
        state: "DEEP_DIVE",
        updatedContext: { debriefQuestionQueue: [], debriefQuestionsAsked, debriefSchoolId: selectedSchoolId }
      };
    }
    
    if (isNewDebrief || (debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length === 0)) {
      console.log('[E13a] Generating debrief question queue');
      debriefQuestionQueue = [];
      debriefQuestionsAsked = [];
      
      // Slot 0: Persona-generated opener
      const openerQ = consultantName === 'Jackie'
        ? 'How did it feel walking through the halls and seeing the spaces? What emotions came up?'
        : 'Did anything surprise you compared to what they advertise on their website or what you expected?';
      debriefQuestionQueue.push(openerQ);
      
      // Slots 1-2: Pull from VisitPrepKit or generate from priorities
      if (priorVisitQuestions.length > 0) {
        const q1 = typeof priorVisitQuestions[0] === 'string' ? priorVisitQuestions[0] : priorVisitQuestions[0]?.question;
        const q2 = priorVisitQuestions.length > 1 ? (typeof priorVisitQuestions[1] === 'string' ? priorVisitQuestions[1] : priorVisitQuestions[1]?.question) : null;
        if (q1) debriefQuestionQueue.push(q1);
        if (q2) debriefQuestionQueue.push(q2);
      } else {
        const priorities = conversationFamilyProfile?.priorities || [];
        if (priorities.length > 0) {
          debriefQuestionQueue.push(`How did they handle ${priorities[0]}? Did you see that reflected in the school?`);
        }
        if (priorities.length > 1) {
          debriefQuestionQueue.push(`What was your impression of their approach to ${priorities[1]}?`);
        }
      }
      
      // Ensure we always have 3 questions
      while (debriefQuestionQueue.length < 3) {
        debriefQuestionQueue.push('What was your overall impression?');
      }
    }
    
    // Pop next question if queue isn't empty
    let nextQuestion = '';
    if (debriefQuestionQueue.length > 0) {
      nextQuestion = debriefQuestionQueue.shift();
      debriefQuestionsAsked.push(nextQuestion);
    }
    
    const isDebriefComplete = debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length >= 3;
    const debriefQuestionsContext = `${nextQuestion ? `Next focus: "${nextQuestion}"` : 'Wrap up naturally — you\'ve asked your key questions.'}\n\nQuestions asked so far: ${debriefQuestionsAsked.length}/3`;
    
    // E52-A4: Build debrief prompt via buildPromptContext
    const debriefPersonaTone = consultantName === 'Jackie'
      ? 'JACKIE TONE: Warm, empathetic, encouraging. Acknowledge their feelings and experiences before asking next question. Validate emotional responses. Help them feel heard.'
      : 'LIAM TONE: Direct, analytical, practical. Acknowledge their observations factually before asking next question. Compare to expectations and data. Focus on fit assessment.';

    const debriefInstructions = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}You are ${consultantName}, an education consultant. The family just returned from visiting ${schoolName}.\n\n${debriefQuestionsContext}\n\n${debriefPersonaTone}`;

    const debriefFamilyBrief: FamilyBrief = {
      childName: conversationFamilyProfile?.child_name || undefined,
      grade: conversationFamilyProfile?.child_grade ?? undefined,
      location: conversationFamilyProfile?.location_area || undefined,
      priorities: conversationFamilyProfile?.priorities || undefined,
      dealbreakers: conversationFamilyProfile?.dealbreakers || undefined,
    };

    const debriefSessionState: SessionState = {
      currentState: 'DEEP_DIVE',
      consultantName: consultantName || undefined,
      selectedSchoolId: selectedSchoolId || undefined,
    };

    const debriefPromptCtx = await buildPromptContext({
      userMessage: processMessage,
      systemInstructions: debriefInstructions,
      familyBrief: debriefFamilyBrief,
      sessionState: debriefSessionState,
      conversationHistory: [],  // debrief uses its own Q&A tracking, not full history
      conversationId: context?.conversationId || undefined,
    });
    console.log(`[E52-A4] DEBRIEF buildPromptContext: ${debriefPromptCtx.totalTokens} tokens, trimmed=${debriefPromptCtx.trimmed}`);

    const debriefUserPrompt = `Family just said: "${processMessage}"

${isDebriefComplete ? 'They\'ve shared their impressions. Wrap up warmly, validate their insights, and summarize what you heard.' : `Ask them: "${nextQuestion}"\n\nBe natural — don't sound robotic.`}`;

    let debriefMessage = "Tell me about your visit experience.";
    try {
      const debriefResponse = await callOpenRouter({
        systemPrompt: debriefPromptCtx.context,
        userPrompt: debriefUserPrompt,
        maxTokens: 500,
        temperature: 0.7
      });
      debriefMessage = debriefResponse || "Tell me about your visit experience.";
    } catch (openrouterError) {
      try {
        const fallbackResponse = await Promise.race([
          callOpenRouter({
            prompt: debriefPromptCtx.context + '\n\n' + debriefUserPrompt,
            model: 'gpt_5_mini'
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 8s')), 8000))
        ]);
        debriefMessage = fallbackResponse?.response || fallbackResponse || "Tell me about your visit experience.";
      } catch (fallbackError) {
        console.error('[E13a] Debrief response failed:', fallbackError.message);
      }
    }

    // WC9: Persist debrief Q&A pair (non-blocking)
    if (nextQuestion && context.userId && context.conversationId) {
      try {
        const newQAPair = {
          question: nextQuestion,
          answer: processMessage,
          timestamp: new Date().toISOString()
        };

        const existingArtifacts = await ConversationArtifacts.filter({
          conversation_id: context.conversationId,
          school_id: selectedSchoolId,
          artifact_type: 'visit_debrief'
        });

        if (existingArtifacts && existingArtifacts.length > 0) {
          const artifact = existingArtifacts[0];
          const updatedQAPairs = (artifact.content?.qaPairs || []).concat([newQAPair]);
          await ConversationArtifacts.update(artifact.id, {
            content: { ...artifact.content, qaPairs: updatedQAPairs }
          });
          console.log('[E13a] Debrief Q&A appended to artifact:', artifact.id);
        } else {
          const created = await ConversationArtifacts.create({
            user_id: context.userId,
            conversation_id: context.conversationId,
            school_id: selectedSchoolId,
            artifact_type: 'visit_debrief',
            title: 'Visit Debrief - ' + schoolName,
            content: { qaPairs: [newQAPair], schoolName: schoolName },
            status: 'ready',
            is_shared: false,
            pdf_url: null,
            share_token: null
          });
          console.log('[E13a] Debrief artifact created:', created.id);
        }
      } catch (persistError) {
        console.error('[E13a] Debrief persistence failed (non-blocking):', persistError.message);
      }
    }

    // E29-006: Fire-and-forget — mark SchoolJourney entity as visited on debrief completion
    if (isDebriefComplete && context.userId) {
      (async () => {
        try {
          const journeys = context.journeyId
            ? await FamilyJourney.filter({ id: context.journeyId })
            : await FamilyJourney.filter({ user_id: context.userId }, undefined, 1);
          const familyJourney = journeys?.[0];
          if (!familyJourney) return;

          const existing = await SchoolJourney.filter({
            family_journey_id: familyJourney.id,
            school_id: selectedSchoolId,
          });

          let sjId = null;
          if (existing && existing.length > 0) {
            await SchoolJourney.update(existing[0].id, { status: 'visited' });
            sjId = existing[0].id;
          } else {
            const created = await SchoolJourney.create({
              family_journey_id: familyJourney.id,
              school_id: selectedSchoolId,
              school_name: school?.name || '',
              status: 'visited',
              added_at: new Date().toISOString(),
            });
            sjId = created?.id;
          }
          console.log('[E29-006] SchoolJourney marked visited for', selectedSchoolId);

          // E29-014: Generate debrief summary + sentiment from Q&A pairs
          if (sjId && context.conversationId) {
            try {
              const debriefArtifacts = await ConversationArtifacts.filter({
                conversation_id: context.conversationId,
                school_id: selectedSchoolId,
                artifact_type: 'visit_debrief'
              });
              const qaPairs = debriefArtifacts?.[0]?.content?.qaPairs || [];
              if (qaPairs.length > 0) {
                const qaText = qaPairs.map((qa, i) => `Q${i+1}: ${qa.question}\nA${i+1}: ${qa.answer}`).join('\n\n');
                const debriefAnalysis = await Promise.race([
                  callOpenRouter({
                    prompt: `A parent just completed a post-visit debrief for ${school?.name || 'a school'}. Analyze their responses and return JSON only.

Debrief Q&A:
${qaText}

Return ONLY this JSON (no markdown): { "debriefSummary": "<2-3 sentences summarizing what the parent observed and felt>", "debriefSentiment": "<POSITIVE|MIXED|NEGATIVE based on overall impression>" }`,
                    response_json_schema: {
                      type: 'object',
                      properties: {
                        debriefSummary: { type: 'string' },
                        debriefSentiment: { type: 'string', enum: ['POSITIVE', 'MIXED', 'NEGATIVE'] }
                      },
                      required: ['debriefSummary', 'debriefSentiment']
                    }
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
                ]);
                const parsed = typeof debriefAnalysis === 'object' ? debriefAnalysis : JSON.parse(debriefAnalysis);
                if (parsed?.debriefSummary) {
                  await SchoolJourney.update(sjId, {
                    debrief_summary: parsed.debriefSummary,
                    debrief_sentiment: parsed.debriefSentiment || 'MIXED'
                  });
                  console.log('[E29-014] SchoolJourney debrief summary stored, sentiment:', parsed.debriefSentiment);
                }
              }
            } catch (debriefErr) {
              console.error('[E29-014] Debrief summary generation failed:', debriefErr?.message);
            }
          }

          // E29-015: Phase auto-advancement → DECIDE if all non-removed schools are now visited
          try {
            const allSchoolJourneys = await SchoolJourney.filter({ family_journey_id: familyJourney.id });
            const activeJourneys = allSchoolJourneys.filter(sj => sj.status !== 'removed');
            const allVisited = activeJourneys.length > 0 && activeJourneys.every(sj => sj.status === 'visited');
            if (allVisited && familyJourney.current_phase !== 'DECIDE') {
              const currentHistory = Array.isArray(familyJourney.phase_history) ? familyJourney.phase_history : [];
              await FamilyJourney.update(familyJourney.id, {
                current_phase: 'DECIDE',
                phase_history: [...currentHistory, { phase: 'DECIDE', enteredAt: new Date().toISOString() }],
              });
              console.log('[E29-015] FamilyJourney advanced to DECIDE — all schools visited');
            }
          } catch (phaseErr) {
            console.error('[E29-015] Phase advance to DECIDE failed:', phaseErr?.message);
          }
        } catch (e) {
          console.error('[E29-006] SchoolJourney visited sync failed:', e?.message || e);
        }
      })();
    }

    let reevalResult = null;
    // E13a-WC3: Fit re-evaluation after debrief complete (non-blocking)
    if (isDebriefComplete && context.userId) {
      await Promise.race([
        processDebriefCompletionLogic( {
          conversationId: context.conversationId,
          schoolId: selectedSchoolId,
          userId: context.userId,
          journeyId: context.journeyId,
          conversationFamilyProfile
        }).catch(e => console.error('[E29-010] Async debrief completion failed:', e.message)),
        new Promise(res => setTimeout(res, 500))
      ]);
    }

    return {
      message: debriefMessage,
      deepDiveMode: 'debrief',
      visitPrepKit: priorAnalysis?.content || null,
      fitReEvaluation: reevalResult || null,
      updatedContext: {
        debriefQuestionQueue,
        debriefQuestionsAsked,
        debriefSchoolId: selectedSchoolId
      }
    };
  } catch (e) {
    console.error('[E13a-S94] Debrief handling failed:', e.message);
    return null;
  }
}

// =============================================================================
// INLINED HELPER: fireJourneyUpdate
// E29-010 + E29-012: Fire-and-forget — runs next-action inference AND session summary
// in parallel, then writes a single FamilyJourney.update. Called at RESULTS + DEEP_DIVE exits.
// =============================================================================
function fireJourneyUpdate(journeyContext, context, conversationHistory, lastUserMessage, phase) {
  const journeyId = journeyContext?.journeyId || context?.journeyId;
  if (!journeyId) return;

  (async () => {
    try {
      const schoolLines = (journeyContext?.schoolsSummary || [])
        .map(s => `- ${s.schoolName}: ${s.status}`)
        .join('\n') || 'None shortlisted yet.';
      const currentPhase = journeyContext?.currentPhase || 'MATCH';
      const priorSummary = journeyContext?.lastSessionSummary || 'N/A';

      // Build a short conversation snippet for the summary (last 6 turns)
      const recentTurns = (conversationHistory || []).slice(-6)
        .filter(m => m?.content)
        .map(m => `${m.role === 'user' ? 'Parent' : 'Consultant'}: ${m.content}`)
        .join('\n');
      const conversationSnippet = recentTurns
        ? `${recentTurns}\nParent: ${lastUserMessage || ''}`
        : `Parent: ${lastUserMessage || ''}`;

      const nextActionPrompt = `You are an education consultant assistant. Based on the following school journey, generate the single most important next action for this family.

Schools:
${schoolLines}
Current phase: ${currentPhase}
Last session: ${priorSummary}

Respond with ONLY a JSON object: { "nextAction": "<one specific sentence>", "nextActionType": "<TOUR|COMPARE|APPLY|REVIEW|FOLLOWUP>", "nextActionDue": "<ISO date within 2 weeks>" }
Keep nextAction under 100 characters. Be specific about school names.`;

      const summaryPrompt = `You are an education consultant assistant. Summarize this school search session in exactly 3 sentences for future reference. Be specific: mention schools discussed, decisions made, and what the family is considering next.

Conversation:
${conversationSnippet}

Schools: ${schoolLines}
Phase: ${currentPhase}

Write 3 sentences only. No headings, no bullet points.`;

      const [nextActionRaw, summaryRaw] = await Promise.all([
        Promise.race([
          callOpenRouter({
            prompt: nextActionPrompt,
            response_json_schema: {
              type: 'object',
              properties: {
                nextAction: { type: 'string' },
                nextActionType: { type: 'string' },
                nextActionDue: { type: 'string' }
              },
              required: ['nextAction', 'nextActionType', 'nextActionDue']
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
        ]),
        Promise.race([
          callOpenRouter({ prompt: summaryPrompt }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
        ])
      ]);

      const parsedAction = typeof nextActionRaw === 'object' ? nextActionRaw : JSON.parse(nextActionRaw);
      const summaryText = typeof summaryRaw === 'string' ? summaryRaw : (summaryRaw?.response || summaryRaw?.text || priorSummary);

      const currentTotal = journeyContext?.totalSessions || 0;

      await FamilyJourney.update(journeyId, {
        next_action: parsedAction.nextAction,
        next_action_type: parsedAction.nextActionType,
        next_action_due: parsedAction.nextActionDue,
        last_session_summary: summaryText,
        total_sessions: currentTotal + 1,
        last_active_at: new Date().toISOString()
      });

      console.log(`[E29-010/012] FamilyJourney updated (${phase}): nextAction="${parsedAction.nextAction}", sessions=${currentTotal + 1}`);
    } catch (e) {
      console.warn(`[E29-010/012] fireJourneyUpdate skipped (${phase}):`, e.message);
    }
  })();
}

// =============================================================================
// =============================================================================
// MAIN: orchestrateConversation
// =============================================================================
export async function orchestrateConversationLogic(params: any) {
  const processRequest = async () => {
    var currentState;
    var briefStatus;

    try {
      const { message, conversationHistory, conversationContext, region, userId, consultantName, currentSchools, userLocation, selectedSchoolId, conversationId: conversationIdFromPayload, returningUserContext, journeyContext, familyBrief } = params;

      // WC6: Build RETURNING USER CONTEXT block if present
      let returningUserContextBlock = null;
      if (returningUserContext?.isReturningUser) {
        const contextParts: string[] = [];
        if (returningUserContext.profileName) contextParts.push(`Session: ${returningUserContext.profileName}`);
        if (returningUserContext.child_name || returningUserContext.child_grade) {
          const childInfo = returningUserContext.child_name
            ? `${returningUserContext.child_name}${returningUserContext.child_grade ? `, Grade ${returningUserContext.child_grade}` : ''}`
            : `Grade ${returningUserContext.child_grade}`;
          contextParts.push(`Child: ${childInfo}`);
        }
        if (returningUserContext.location) contextParts.push(`Location: ${returningUserContext.location}`);
        if (returningUserContext.budget) contextParts.push(`Budget: ${returningUserContext.budget}`);
        if (returningUserContext.priorities) contextParts.push(`Priorities: ${returningUserContext.priorities}`);
        if (returningUserContext.matchedSchoolsCount >= 0) contextParts.push(`Matched schools: ${returningUserContext.matchedSchoolsCount}`);
        if (returningUserContext.shortlistedSchools?.length > 0) contextParts.push(`Shortlisted: ${returningUserContext.shortlistedSchools.join(', ')}`);
        if (returningUserContext.lastActive) contextParts.push(`Last active: ${returningUserContext.lastActive}`);
        
        returningUserContextBlock = `RETURNING USER CONTEXT:\n- ${contextParts.join('\n- ')}\nThis is a returning user. Acknowledge their return naturally in your first response.`;
      }

      // E29-009: Build journeyContextBlock and append to returningUserContextBlock
      if (journeyContext) {
        const jParts: string[] = [];
        if (journeyContext.currentPhase) jParts.push(`Phase: ${journeyContext.currentPhase}`);
        if (journeyContext.schoolsSummary?.length > 0) {
          jParts.push(`Schools: ${journeyContext.schoolsSummary.map(s => `${s.schoolName} (${s.status})`).join(', ')}`);
        }
        if (journeyContext.lastSessionSummary) jParts.push(`Last session: ${journeyContext.lastSessionSummary}`);
        if (journeyContext.nextAction) jParts.push(`Next action: ${journeyContext.nextAction}`);
        let journeyContextBlock = `JOURNEY CONTEXT:\n- ${jParts.join('\n- ')}`;
        if (journeyContextBlock.length > 500) journeyContextBlock = journeyContextBlock.substring(0, 500);
        returningUserContextBlock = returningUserContextBlock
          ? `${returningUserContextBlock}\n\n${journeyContextBlock}`
          : journeyContextBlock;
      }

      // E51-S3B: Fetch visit context for AI awareness (RESULTS/DEEP_DIVE only)
      let visitContextBlock: string | null = null;
      if (userId) {
        try {
          visitContextBlock = await fetchVisitContext(userId, journeyContext?.journeyId);
          if (visitContextBlock) {
            console.log('[E51-S3B] Visit context loaded, length:', visitContextBlock.length);
            // Append visit context to returningUserContextBlock
            const visitInstruction = `\nIf VISIT EXPERIENCE data is present, reference the family's visits naturally (e.g. "Since you visited..." or "You mentioned loving..."). Never say "According to your visit record." If only impression exists without notes, reference the impression without fabricating details. If only notes exist without impression, reference notes without assuming an overall impression. Visit experience should enrich your response, not dominate it.`;
            const fullVisitBlock = visitContextBlock + visitInstruction;
            returningUserContextBlock = returningUserContextBlock
              ? `${returningUserContextBlock}\n\n${fullVisitBlock}`
              : fullVisitBlock;
          }
        } catch (e: any) {
          console.warn('[E51-S3B] fetchVisitContext failed (non-blocking):', e?.message);
        }
      }

      // E29-008: Journey resumption — short-circuit for returning users with an active journey
      if (journeyContext?.journeyId && journeyContext?.isResuming === true && userId && (conversationHistory?.length ?? 0) <= 1) {
        try {
          const consultantPersona = (consultantName || 'Jackie') === 'Jackie'
            ? 'You are Jackie, a warm and empathetic senior education consultant.'
            : 'You are Liam, a direct and analytical senior education strategist.';

          const activeSchools = (journeyContext.schoolsSummary || []).filter(s => s.status !== 'removed');
          const schoolsLine = activeSchools.length > 0
            ? `Schools being considered: ${activeSchools.map(s => `${s.schoolName} (${s.status})`).join(', ')}.`
            : 'No schools shortlisted yet.';

          // E29-011: Determine if nextAction references a now-dropped school
          const droppedSchoolNames = (journeyContext.schoolsSummary || [])
            .filter(s => s.status === 'removed')
            .map(s => s.schoolName.toLowerCase());
          const nextAction = journeyContext.nextAction || null;
          const nextActionReferencesDropped = nextAction && droppedSchoolNames.some(name => nextAction.toLowerCase().includes(name));

          let nextActionLine = '';
          if (nextAction && !nextActionReferencesDropped) {
            nextActionLine = `\n- Previously suggested next step: "${nextAction}" — if they haven't done this yet, mention it gently (e.g. "Last time we suggested you ${nextAction.toLowerCase()} — no rush if you haven't gotten to it yet."). If it seems completed based on school statuses, skip it.`;
          } else if (nextActionReferencesDropped) {
            nextActionLine = `\n- The previously suggested action referenced a school the family has since removed. Do NOT mention it. Instead, suggest a fresh next step based on their current shortlist.`;
          }

          const welcomeBackPrompt = `${consultantPersona}

The family is returning to continue their school search. Here is their journey context:
- Current phase: ${journeyContext.currentPhase || 'MATCH'}
- ${schoolsLine}
- Last session summary: ${journeyContext.lastSessionSummary || 'No summary available'}${nextActionLine}

Write a warm, natural 3-sentence welcome-back greeting. Acknowledge where they left off, reference specific schools or the suggested next step if relevant, and invite them to continue. Be concise and personal. Do NOT ask multiple questions — end with one clear invitation.`;

          const greeting = await Promise.race([
            callOpenRouter({ prompt: welcomeBackPrompt }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 8s')), 8000))
          ]);
          const greetingText = typeof greeting === 'string' ? greeting : (greeting?.response || greeting?.text || 'Welcome back! Ready to pick up where we left off?');

          console.log('[E29-008] Journey resumption short-circuit fired for journeyId:', journeyContext.journeyId);
          return ({
            state: 'JOURNEY_RESUMPTION',
            message: greetingText,
            quickReplies: ["Let's keep going", "Update my Brief", "Start new search"],
            journeyId: journeyContext.journeyId,
            briefStatus: null,
            schools: [],
            familyProfile: null,
            conversationContext: conversationContext || {}
          });
        } catch (e) {
          console.warn('[E29-008] Journey resumption failed, falling through to normal flow:', e.message);
        }
      }

      // __CONFIRM_BRIEF__ and __GUIDED_INTRO_COMPLETE__ sentinels go directly to RESULTS
      let context = conversationContext || {};
      let processMessage = message;
      const isConfirmBrief = message === '__CONFIRM_BRIEF__';
      const isGuidedIntroComplete = message === '__GUIDED_INTRO_COMPLETE__';
      if (isConfirmBrief || isGuidedIntroComplete) {
        processMessage = 'show me schools';
        context.previousState = context.state || 'WELCOME';
        context.state = 'RESULTS';
        console.log(isGuidedIntroComplete
          ? '[E47] __GUIDED_INTRO_COMPLETE__ sentinel: going directly to RESULTS'
          : '[FIX-C] __CONFIRM_BRIEF__ sentinel: going directly to RESULTS');
      }

      console.log('ORCH START', { 
        messageLength: message?.length, 
        conversationHistoryLength: conversationHistory?.length,
        consultant: consultantName,
        userId: userId,
        hasUserLocation: !!userLocation
      });
      
      const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE', JOURNEY_RESUMPTION: 'JOURNEY_RESUMPTION' };
      
      let briefEditCount = context.briefEditCount || 0;
      // BUG-RN-PERSIST Fix B2: Prefer top-level conversationId from payload over
      // context.conversationId which may be stale/null from a previous render cycle.
      const conversationId = conversationIdFromPayload || context.conversationId;

      // P4-4.1: Read briefStatus from normalized conversation_state table (authoritative source)
      // Falls back to context.briefStatus if row doesn't exist (backward compat)
      if (conversationId && !isConfirmBrief && !isGuidedIntroComplete) {
        try {
          const csRow = await readConversationState(conversationId);
          if (csRow) {
            const dbBriefStatus = csRow.brief_status ?? null;
            if (dbBriefStatus && !context.briefStatus) {
              context.briefStatus = dbBriefStatus;
              console.log('[P4-4.1] briefStatus hydrated from conversation_state:', dbBriefStatus);
            } else if (dbBriefStatus && context.briefStatus !== dbBriefStatus) {
              console.log('[P4-4.1] briefStatus: conversation_state has', dbBriefStatus, '/ context has', context.briefStatus, '— using DB value');
              context.briefStatus = dbBriefStatus;
            }
          }
        } catch (e: any) {
          console.warn('[P4-4.1] Failed to read conversation_state, falling back to context:', e.message);
        }
      }

      // STEP 0: Initialize/retrieve FamilyProfile
      let conversationFamilyProfile = null;
      
      if (userId && conversationId) {
        try {
          const profiles = await FamilyProfile.filter({ user_id: userId, conversation_id: conversationId });
          conversationFamilyProfile = profiles.length > 0 ? profiles[0] : null;
          
          if (!conversationFamilyProfile) {
            conversationFamilyProfile = await FamilyProfile.create({ user_id: userId, conversation_id: conversationId });
            console.log('Created new FamilyProfile:', conversationFamilyProfile.id);

            // S141-WC2: E29-HYDRATE — Seed new profile from journey briefSnapshot on session resume
            if (journeyContext?.briefSnapshot) {
              try {
                const snapshot = typeof journeyContext.briefSnapshot === 'string' ? JSON.parse(journeyContext.briefSnapshot) : journeyContext.briefSnapshot;
                const seedFields = ['child_name','child_grade','child_gender','gender','location_area','max_tuition','interests','priorities','dealbreakers','curriculum_preference','school_type_label','academic_strengths'];
                const seedData: Record<string, any> = {};
                for (const key of seedFields) {
                  if (snapshot[key] != null && !conversationFamilyProfile[key]) {
                    seedData[key] = snapshot[key];
                  }
                }
                if (Object.keys(seedData).length > 0) {
                  await FamilyProfile.update(conversationFamilyProfile.id, seedData);
                  Object.assign(conversationFamilyProfile, seedData);
                  console.log('[E29-HYDRATE] Seeded FamilyProfile from briefSnapshot:', Object.keys(seedData));
                }
              } catch (hydrateErr) {
                console.error('[E29-HYDRATE] Failed to hydrate from briefSnapshot:', hydrateErr);
              }
            }
          }
        } catch (e) {
          console.error('FamilyProfile error:', e);
        }
      } else {
        conversationFamilyProfile = {
          child_name: null, child_grade: null, location_area: null, max_tuition: null,
          interests: [], priorities: [], dealbreakers: [], academic_strengths: []
        };
      }
      
      // E47: Seed FamilyProfile from guided intro FamilyBrief (pre-extracted entities)
      if (familyBrief && conversationFamilyProfile) {
        const briefToProfile: Record<string, any> = {};
        if (familyBrief.childName && !conversationFamilyProfile.child_name) briefToProfile.child_name = familyBrief.childName;
        if (familyBrief.grade != null && conversationFamilyProfile.child_grade == null) {
          // Parse grade string to number if needed (e.g. "7" → 7, "JK" → -1)
          const gradeMap: Record<string, number> = { 'PK': -2, 'JK': -1, 'SK': 0, 'K': 0 };
          const gradeStr = String(familyBrief.grade).toUpperCase();
          briefToProfile.child_grade = gradeMap[gradeStr] !== undefined ? gradeMap[gradeStr] : parseInt(gradeStr) || null;
        }
        if (familyBrief.location && !conversationFamilyProfile.location_area) briefToProfile.location_area = familyBrief.location;
        if (familyBrief.budget && conversationFamilyProfile.max_tuition == null) briefToProfile.max_tuition = familyBrief.budget;
        if (familyBrief.schoolTypePreferences?.length > 0 && (!conversationFamilyProfile.school_type_label)) {
          briefToProfile.school_type_label = familyBrief.schoolTypePreferences.join(', ');
        }
        if (familyBrief.pronoun && !conversationFamilyProfile.child_pronoun) briefToProfile.child_pronoun = familyBrief.pronoun;
        if (Object.keys(briefToProfile).length > 0) {
          Object.assign(conversationFamilyProfile, briefToProfile);
          // Persist to DB if profile has an id
          if (conversationFamilyProfile.id) {
            try {
              await FamilyProfile.update(conversationFamilyProfile.id, briefToProfile);
              console.log('[E47] Seeded FamilyProfile from familyBrief:', Object.keys(briefToProfile));
            } catch (e: any) {
              console.warn('[E47] FamilyProfile seed persist failed (non-blocking):', e.message);
            }
          }
        }
      }

      const isFirstMessage = conversationHistory?.length === 0;
      let extractionResult = null;
      let intentSignal = 'continue';
      let briefDelta = { additions: [], updates: [], removals: [] };

      if (conversationFamilyProfile && context.extractedEntities) {
        for (const [key, value] of Object.entries(context.extractedEntities)) {
          if (value !== null && value !== undefined && !['briefDelta', 'intentSignal'].includes(key)) {
            const existing = conversationFamilyProfile[key];
            const isEmpty = existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0);
            if (isEmpty) {
              conversationFamilyProfile[key] = value;
            }
          }
        }
      }

      const tier1Before = {
        child_grade: conversationFamilyProfile?.child_grade ?? null,
        location_area: conversationFamilyProfile?.location_area ?? null,
        max_tuition: conversationFamilyProfile?.max_tuition ?? null,
        gender: conversationFamilyProfile?.gender ?? null
      };

      // S108-WC3 Fix 1 (Hoisted): lightweightExtract + workingProfile built BEFORE all state branches
      // Merge order: accumulated < DB < bridgeProfile (fresh extraction always wins)
      // For-loop patches any DB nulls that accumulated already knew.
      const { bridgeProfile, bridgeIntent } = lightweightExtract(processMessage, conversationFamilyProfile);
      let accumulatedProfile = context.accumulatedFamilyProfile || {};
      if (Object.keys(accumulatedProfile).filter(k => accumulatedProfile[k] != null).length === 0 && conversationFamilyProfile?.id) {
        accumulatedProfile = { ...conversationFamilyProfile };
        context.accumulatedFamilyProfile = accumulatedProfile;
        console.log('[RESUME-FIX] Seeded accumulatedFamilyProfile from DB FamilyProfile');
      }
      const workingProfile = mergeProfile(mergeProfile(accumulatedProfile, conversationFamilyProfile), bridgeProfile);
      // E42-FIX: Ensure .id survives merge — entity .id may be non-enumerable/getter
      if (conversationFamilyProfile?.id && !workingProfile.id) {
        workingProfile.id = conversationFamilyProfile.id;
      }
      for (const [key, val] of Object.entries(workingProfile)) {
        if (val === null || val === undefined) {
          if (accumulatedProfile[key] != null) workingProfile[key] = accumulatedProfile[key];

              // S114-WC1: Preserve dealbreakers from bridge extraction - merge chain may lose them
    if (bridgeProfile?.dealbreakers && Array.isArray(bridgeProfile.dealbreakers) && bridgeProfile.dealbreakers.length > 0) {
      workingProfile.dealbreakers = bridgeProfile.dealbreakers;
    }
    if (bridgeProfile?.school_gender_exclusions && Array.isArray(bridgeProfile.school_gender_exclusions) && bridgeProfile.school_gender_exclusions.length > 0) {
      workingProfile.school_gender_exclusions = bridgeProfile.school_gender_exclusions;
    }
        }
      }
      context.accumulatedFamilyProfile = workingProfile;
      Object.assign(conversationFamilyProfile, bridgeProfile);
      intentSignal = bridgeIntent;
      briefDelta = { additions: [], updates: [], removals: [] };

      // EDIT-CRITERIA DETERMINISTIC OVERRIDE
      // Fires when state is RESULTS and message matches known criteria-change patterns.
      // Needed because extractEntities is fire-and-forget so intentSignal never arrives from it.
      if (context.state === STATES.RESULTS) {
        const EDIT_CRITERIA_RE = /budget changed|change my budget|new budget|budget is now|actually my budget|change location|moved to|we live in|change to|switch to|need french|want boarding|no boarding|no religious|add religious|change grade|going into grade|update my|change my criteria|change my preferences|revise|redo my brief|start over/i;
        if (EDIT_CRITERIA_RE.test(processMessage || '')) {
          intentSignal = 'edit-criteria';
          console.log('[INTENT-OVERRIDE] edit-criteria detected from message regex');
        }
      }

      // S113-WC1: extractEntities stub — will be replaced conditionally after resolveTransition
      extractionResult = {
        extractedEntities: {},
        updatedFamilyProfile: conversationFamilyProfile,
        updatedContext: context,
        intentSignal: intentSignal,
        briefDelta: briefDelta
      };
      
      Object.assign(conversationFamilyProfile, extractionResult.updatedFamilyProfile);
      // E29-009: Exclude debrief context fields from extractEntities merge to prevent overwrite
const { debriefQuestionQueue: _dq, debriefQuestionsAsked: _da, debriefSchoolId: _ds, isNewDebrief: _ind, activeDebriefSchoolName: _adn, hasActiveDebrief: _had, ...safeUpdatedContext } = extractionResult.updatedContext || {};
Object.assign(context, safeUpdatedContext);

      const tier1After = {
        child_grade: conversationFamilyProfile?.child_grade ?? null,
        location_area: conversationFamilyProfile?.location_area ?? null,
        max_tuition: conversationFamilyProfile?.max_tuition ?? null,
        gender: conversationFamilyProfile?.gender ?? null
      };
      const tier1Changed = Object.keys(tier1Before).some(k => {
        const oldVal = tier1Before[k];
        const newVal = tier1After[k];
        if (newVal === null || newVal === undefined) return false;
        if (oldVal === null || oldVal === undefined) return true;
        return oldVal !== newVal;
      });
      const extractedKeys = Object.keys(extractionResult?.extractedEntities || {}).filter(k =>
        !['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers'].includes(k)
      );
      const anyEntityExtracted = extractedKeys.length > 0;
      const inResultsOrDeepDive = context.state === STATES.RESULTS || context.state === STATES.DEEP_DIVE;
      // BUG-E41: Gate autoRefresh on intentSignal to prevent informational questions from replacing results
      const intentSignalForRefresh = extractionResult?.intentSignal || 'continue';
      const refreshIntents = new Set(['edit-criteria', 'request-results']);
      const shouldAutoRefresh = (tier1Changed || anyEntityExtracted)
        && inResultsOrDeepDive
        && refreshIntents.has(intentSignalForRefresh);
      context.resultsStale = false;
      context.autoRefreshed = shouldAutoRefresh;
      if (shouldAutoRefresh) {
        console.log('[T047] Entity change detected in RESULTS/DEEPDIVE — will auto-refresh matches');
        console.log('[T047] Changed entities:', extractedKeys, '| Tier1 changed:', tier1Changed);
      }

      if (isFirstMessage && !context.state && !journeyContext?.isResuming && !selectedSchoolId) { // FIX-DD-STARTUP: bypass welcome when school selected // S169-WC1: E29-RESUMPTION-FIX    if (!activeJourney?.isResuming) {
    // Initialize first message with consultant's greeting
        console.log('[ORCH] First message, return WELCOME greeting');
        const welcomeMessage = consultantName === 'Jackie'
          ? "Hey there — I'm Jackie. I've worked with hundreds of families going through exactly this. Tell me a bit about your child and what's prompting the search."
          : "Hi, I'm Liam. I'll help you cut through the noise and find schools that actually fit. What's driving the search?";
        return ({
          message: welcomeMessage,
          state: STATES.WELCOME,
          briefStatus: null,
          conversationContext: context,
          familyProfile: conversationFamilyProfile,
          extractedEntities: extractionResult?.extractedEntities || {},
          schools: [],
          stateEnvelope: { state: STATES.WELCOME, briefStatus: null, previousState: null, transitionReason: 'initial' }
        });
      }
      
      const profileData = {
        location_area: workingProfile?.location_area || null,
        child_grade: workingProfile?.child_grade ?? null,
        max_tuition: workingProfile?.max_tuition || null,
        priorities: workingProfile?.priorities || [],
        dealbreakers: workingProfile?.dealbreakers || [],
        curriculum: workingProfile?.curriculum_preference || [],
        school_type_label: workingProfile?.school_type_label || null
      };
      
      const turnCount = (conversationHistory?.filter(m => m.role === 'user').length || 0) + 1;
      const currentBriefEditCount = context.briefEditCount || 0;
      const previousSchoolId = context.previousSchoolId || null;
      
      const resolveResult = resolveTransition({
        currentState: context.state || STATES.WELCOME,
        intentSignal,
        profileData,
        turnCount,
        briefEditCount: currentBriefEditCount,
        selectedSchoolId,
        previousSchoolId,
        userMessage: processMessage,
        tier1CompletedTurn: context.tier1CompletedTurn || null,
        briefStatus: context.briefStatus || null,
        context
      });
      
      currentState = resolveResult.nextState;
      briefStatus = resolveResult.briefStatus || context.briefStatus || null;
      const { flags } = resolveResult;

      if (resolveResult.clearSelectedSchool) {
        context.selectedSchoolId = null;
        context.previousSchoolId = null;
      }

      // BUG 2 FIX: Capture previousState BEFORE overwriting context.state
      const previousState = context.state || STATES.WELCOME;
      context.previousState = previousState;

      // P4-S4.2: Build canonical state envelope — single source of truth for state transitions
      const stateEnvelope = {
        state: currentState,
        briefStatus,
        previousState,
        transitionReason: resolveResult.transitionReason || 'natural'
      };

      console.log('[ORCH] resolveTransition:', { nextState: currentState, intentSignal, sufficiency: resolveResult.sufficiency });

      // S136-WC1: E35-REC1 — fire-and-forget for non-RESULTS states
      // E41-S3: RESULTS state defers extraction to post-reply (with aiReply for richer context)
      // S1-S2: Persistence moved here from extractEntitiesLogic (single write point)
      // S3-S5: Uses applyExtractionDelta for merge, delta-only extraction
      if (currentState !== STATES.RESULTS) {
        extractEntitiesLogic( {
          message: processMessage,
          conversationFamilyProfile,
          context,
          conversationHistory
        }).then(async (extractResult) => {
          const delta = extractResult?.extractedEntities || {};
          const deltaFields = Object.keys(delta).filter(k =>
            !['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers'].includes(k)
          );
          if (deltaFields.length === 0) return; // S3-S5: empty delta = no-op

          const profile = extractResult?.updatedFamilyProfile;
          if (profile?.id) {
            try {
              const NON_SCHEMA_KEYS = ['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers', 'gender'];
              const profileToSave = { ...profile };
              for (const key of NON_SCHEMA_KEYS) {
                delete profileToSave[key];
              }
              await FamilyProfile.update(profile.id, profileToSave);
              console.log('[S3-S5] FamilyProfile persisted (non-RESULTS):', profile.id, 'delta:', deltaFields);
            } catch (e: any) {
              console.error('[S3-S5] FamilyProfile update failed (non-blocking):', e.message);
            }
          }
        }).catch(e => console.error('[S136-WC1] extractEntities fire-and-forget failed:', e.message));
      }

      // GIBBERISH DETECTION: Catch nonsensical input before routing to handlers
      const normalizedMsg = (processMessage || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
      const vowels = normalizedMsg.match(/[aeiou]/g) || [];
      const looksLikeBudget = /^\d+[kK]?$/.test(normalizedMsg);
      const isGibberish = vowels.length === 0 && normalizedMsg.length > 2 && !looksLikeBudget;

      if (isGibberish) {
        const nudgeMessage = consultantName === 'Jackie'
          ? "I'm not quite catching what you mean — could you rephrase that? I want to make sure I understand your thoughts."
          : "That didn't parse. Could you say that again in a different way?";

        console.log('[GIBBERISH] Detected gibberish input:', processMessage);
        return ({
          message: nudgeMessage,
          state: currentState,
          briefStatus: briefStatus,
          familyProfile: conversationFamilyProfile,
          conversationContext: context,
          extractedEntities: extractionResult?.extractedEntities || {},
          schools: [],
          stateEnvelope
        });
      }

      context.state = currentState;
      context.briefStatus = briefStatus;

      // E52-B2: OFF_TOPIC guardrail — tiered warm deflections, no school context injected
      if (detectOffTopic(processMessage || '')) {
        context.offTopicCount = (context.offTopicCount || 0) + 1;
        console.log('[E52-B2] OFF_TOPIC detected, tier:', Math.min(context.offTopicCount, 3), '| count:', context.offTopicCount);

        const shortlistCount = (currentSchools || []).length;
        const activeSchoolName = selectedSchoolId
          ? (currentSchools || []).find(s => s.id === selectedSchoolId)?.name || null
          : null;
        const hasActiveDebrief = !!(context.hasActiveDebrief || context.activeDebriefSchoolName);
        const journeyPhase = journeyContext?.currentPhase || null;

        const deflection = guardrailResponse(context.offTopicCount, {
          shortlistCount,
          activeSchoolName,
          hasActiveDebrief,
          journeyPhase,
          consultantName,
        });

        return ({
          message: deflection,
          state: currentState,
          briefStatus,
          familyProfile: conversationFamilyProfile,
          conversationContext: context,
          extractedEntities: extractionResult?.extractedEntities || {},
          schools: currentSchools || [],
          stateEnvelope,
        });
      }
      // E52-B2: Reset off-topic counter on any on-topic message
      if (context.offTopicCount) {
        console.log('[E52-B2] On-topic message, resetting offTopicCount from', context.offTopicCount);
        context.offTopicCount = 0;
      }

      context.dataSufficiency = resolveResult.sufficiency;
      context.transitionReason = resolveResult.transitionReason;
      if (resolveResult.tier1CompletedTurn !== undefined && resolveResult.tier1CompletedTurn !== null) {
        context.tier1CompletedTurn = resolveResult.tier1CompletedTurn;
      } else if ((resolveResult.flags as any)?.tier1CompletedTurn) {
        context.tier1CompletedTurn = (resolveResult.flags as any).tier1CompletedTurn;
      }

      console.log(`[STATE] ${currentState} | briefStatus: ${briefStatus} | sufficiency: ${context.dataSufficiency} | reason: ${context.transitionReason}`);

      let responseData;

      if (currentState === STATES.DISCOVERY) {
        responseData = await handleDiscovery(processMessage, workingProfile, context, conversationHistory, consultantName, currentSchools, flags, returningUserContextBlock);
        responseData.familyProfile = workingProfile;
        responseData.extractedEntities = workingProfile;
        responseData.stateEnvelope = stateEnvelope;
        return (responseData); // DISCOVERY returns early; workingProfile already set above
      }

      if (currentState === STATES.RESULTS) {
        // BUG-FLOW-002 FIX: Ensure FamilyProfile is persisted before calling searchSchools
        if (conversationFamilyProfile?.id && Object.keys(extractionResult?.extractedEntities || {}).length > 0) {
          try {
            const finalProfile = await FamilyProfile.filter({ id: conversationFamilyProfile.id });
            if (finalProfile.length > 0) {
              conversationFamilyProfile = mergeProfile(conversationFamilyProfile, finalProfile[0]);
              console.log('[RESULTS] Refreshed FamilyProfile from DB:', conversationFamilyProfile.id);
            }
          } catch (e) {
            console.error('[RESULTS] Failed to refresh FamilyProfile:', e.message);
          }
        }

        // E13a: Check if debrief mode is set — if so, route to inlined handleVisitDebrief
        if (resolveResult.deepDiveMode === 'debrief') {
          console.log('[E13a] Routing RESULTS->DEBRIEF to inlined handleVisitDebrief');
          const debriefResult = await handleVisitDebriefInternal(selectedSchoolId, processMessage, workingProfile, context, consultantName, returningUserContextBlock, callOpenRouter);
          if (debriefResult) {
            if (debriefResult.updatedContext) Object.assign(context, debriefResult.updatedContext);
            context.state = STATES.DEEP_DIVE;
            // Phase 1c: Dual-write conversation state to normalized table
            syncConversationState(conversationId, userId, context);
            return ({ message: debriefResult.message, state: STATES.DEEP_DIVE, briefStatus, deepDiveMode: debriefResult.deepDiveMode, visitPrepKit: debriefResult.visitPrepKit, fitReEvaluation: debriefResult.fitReEvaluation || null, familyProfile: workingProfile, conversationContext: context, extractedEntities: extractionResult?.extractedEntities || {}, schools: currentSchools || [], stateEnvelope: { ...stateEnvelope, state: STATES.DEEP_DIVE } });
          }
          console.log('[E13a] handleVisitDebrief returned null, falling through to handleResults');
        }

        // WC10: Fire-and-forget narrative generation (non-blocking)
        const isBriefConfirmedTransition = isConfirmBrief;
        if (isBriefConfirmedTransition && userId && conversationId) {
          (async () => {
            try {
              await generateProfileNarrativeLogic( {
                conversationFamilyProfile,
                conversationHistory,
                consultantName,
                conversationId
              });
              console.log('[WC10] Narrative generated (non-blocking)');
            } catch (e) {
              console.error('[WC10] Narrative failed (non-blocking):', e.message);
            }
          })();

          // E42-PERSIST Phase 1a: Persist Family Brief as ConversationArtifacts at BRIEF→RESULTS transition
          // Use responseData.message (the just-generated brief) — NOT conversationHistory which doesn't contain it yet.
          if (userId && conversationId) {
            (async () => {
              try {
                const briefText = responseData?.message || '';
                if (!briefText) {
                  console.warn('[E42-PERSIST] No brief text in responseData.message, skipping artifact write');
                  return;
                }
                const existing = await ConversationArtifacts.filter({
                  user_id: userId,
                  conversation_id: conversationId,
                  artifact_type: 'family_brief'
                });
                const generatedAt = new Date().toISOString();
                const artifactContent = JSON.stringify({ briefText, structuredProfile: workingProfile });
                if (existing && existing.length > 0) {
                  await ConversationArtifacts.update(existing[0].id, {
                    content: artifactContent,
                    generated_at: generatedAt,
                    metadata: { consultantName: consultantName || 'jackie', version: 'E42_V1' }
                  });
                  console.log('[E42-PERSIST] family_brief updated:', existing[0].id);
                } else {
                  const created = await ConversationArtifacts.create({
                    user_id: userId,
                    conversation_id: conversationId,
                    artifact_type: 'family_brief',
                    content: artifactContent,
                    generated_at: generatedAt,
                    status: 'active',
                    metadata: { consultantName: consultantName || 'jackie', version: 'E42_V1' }
                  });
                  console.log('[E42-PERSIST] family_brief created:', created.id);
                }
              } catch (e) {
                console.error('[E42-PERSIST] family_brief persistence failed (non-blocking):', e.message);
              }
            })();
          }
        } else if (context.state === STATES.RESULTS) {
          console.warn('[E42-PERSIST] family_brief gate not met:', {
            previousState: context.previousState,
            briefStatus,
            isConfirmBrief,
            hasUserId: !!userId,
            hasConversationId: !!conversationId
          });
        }

        // E29-003: Fire-and-forget FamilyJourney creation at Brief confirmation
        const briefJustConfirmed = isConfirmBrief || (resolveResult.briefStatus === 'confirmed' && resolveResult.transitionReason?.startsWith('brief_confirmed'));
        if (briefJustConfirmed) {
          (async () => {
            try {
              const briefSnapshot = JSON.parse(JSON.stringify(conversationFamilyProfile || {}));
              const childName = conversationFamilyProfile?.child_name || conversationFamilyProfile?.conversationContext?.child_name || 'My Child';
              const journey = await FamilyJourney.create({
                user_id: userId,
                child_name: childName,
                profile_label: `${childName}'s School Search`,
                current_phase: 'MATCH',
                phase_history: [
                  { phase: 'UNDERSTAND', enteredAt: new Date().toISOString(), completedAt: new Date().toISOString() },
                  { phase: 'MATCH', enteredAt: new Date().toISOString(), completedAt: null }
                ],
                family_profile_id: conversationFamilyProfile?.id || '',
                brief_snapshot: briefSnapshot,
                consultant_id: consultantName || 'jackie',
                school_journeys: [],
                total_sessions: 1,
                last_active_at: new Date().toISOString(),
                is_stale: false,
                is_archived: false
              });
              context.journeyId = journey.id;
              await ChatHistory.update(conversationId, { journey_id: journey.id });
              console.log('[E29] FamilyJourney created:', journey.id);
            } catch (e) {
              console.error('[E29] FamilyJourney creation failed (non-blocking):', e.message);
            }
          })();
        }

        // E29-010/E29-012: Fire-and-forget — next action + session summary + totalSessions increment
        fireJourneyUpdate(journeyContext, context, conversationHistory, message, 'RESULTS');

        const autoRefresh = context.autoRefreshed === true;
        // E41-S3: classifyIntent pre-classification (~50ms, no LLM)
        const intentClassification = classifyIntentFn(processMessage);
        console.log('[E41-S3] classifyIntent:', intentClassification);

        // E50-S1B: Fetch user's research notes for the selected school (if any)
        const userSchoolNotes = selectedSchoolId && userId
          ? await fetchSchoolNotes(userId, selectedSchoolId)
          : null;

        const resultsResult = await handleResultsLogic( {
          message: processMessage,
          conversationFamilyProfile: workingProfile,
          context,
          conversationHistory,
          consultantName,
          briefStatus,
          selectedSchoolId,
          conversationId,
          userId,
          userLocation,
          autoRefresh,
          extractedEntities: extractionResult?.extractedEntities || {},
          gate: intentClassification.gate,
          actionHint: intentClassification.actionHint,
          returningUserContextBlock,
          previousSchools: (currentSchools && currentSchools.length > 0) ? currentSchools : (context.lastMatchedSchools || []),
          userSchoolNotes
        });
        responseData = resultsResult;
        responseData.conversationContext = {
          ...(responseData.conversationContext || {}),
          autoRefreshed: autoRefresh,
          resolvedLat: responseData.resolvedLat || workingProfile?.resolvedLat || null,
          resolvedLng: responseData.resolvedLng || workingProfile?.resolvedLng || null,
        };
        responseData.extractedEntities = extractionResult?.extractedEntities || {};

        // E47: Override message with warm greeting when coming from guided intro
        if (isGuidedIntroComplete && familyBrief) {
          const pName = familyBrief.parentName || '';
          const cName = familyBrief.childName || 'your child';
          const gradeLabel = familyBrief.grade != null ? `Grade ${familyBrief.grade}` : '';
          const loc = familyBrief.location || '';
          const budgetLabel = familyBrief.budget ? `$${Number(familyBrief.budget).toLocaleString()}` : '';
          const detailParts = [gradeLabel, loc ? `in ${loc}` : '', budgetLabel ? `a budget around ${budgetLabel}` : ''].filter(Boolean);
          const detailLine = detailParts.join(', ');
          const schoolCount = (responseData.schools || []).length;
          const matchLine = schoolCount > 0
            ? `I found ${schoolCount} school${schoolCount === 1 ? '' : 's'} that match${schoolCount === 1 ? 'es' : ''} — take a look!`
            : "Let me search for the best matches...";
          responseData.message = consultantName === 'Jackie'
            ? `Got it, ${pName}! I have ${cName}'s details — ${detailLine}. ${matchLine}`
            : `Noted, ${pName}. ${cName} — ${detailLine}. ${matchLine}`;
          console.log('[E47] Warm greeting injected for guided intro completion');
        }

        // E32-001: Validate and attach actions
        // Fast path returns pre-validated actions directly; normal path uses rawToolCalls
        if (!responseData.actions) {
          const validSchoolIds_results = new Set((responseData.schools || currentSchools || []).map(s => s.id));
          responseData.actions = responseData.rawToolCalls ? validateActions(responseData.rawToolCalls, validSchoolIds_results, conversationId) : [];
          delete responseData.rawToolCalls;
        }

        // E41-S6: Handle EDIT_CRITERIA action — merge profileDelta and re-search
        const editCriteriaAction = responseData.actions?.find(a => a.type === 'EDIT_CRITERIA');
        if (editCriteriaAction?.payload?.profileDelta && Object.keys(editCriteriaAction.payload.profileDelta).length > 0) {
          try {
            const delta = editCriteriaAction.payload.profileDelta;
            console.log('[E41-S6] EDIT_CRITERIA delta:', delta);
            // Merge delta into workingProfile
            Object.assign(workingProfile, delta);
            context.accumulatedFamilyProfile = { ...(context.accumulatedFamilyProfile || {}), ...delta };

            // E42-PERSIST Phase 1b: Persist EDIT_CRITERIA profile changes to FamilyProfile entity
            if (userId && conversationId) {
              (async () => {
                try {
                  const PROFILE_FIELDS = [
                    'child_name', 'child_grade', 'child_gender',
                    'location_area', 'max_tuition', 'priorities',
                    'interests', 'dealbreakers', 'learning_differences',
                    'curriculum_preference', 'school_type_label',
                    'academic_strengths', 'parent_notes',
                    'school_gender_exclusions', 'school_gender_preference',
                  ];
                  const updatePayload: Record<string, any> = {};
                  for (const field of PROFILE_FIELDS) {
                    if (delta[field] !== undefined && delta[field] !== null) {
                      updatePayload[field] = delta[field];
                    }
                  }
                  if (Object.keys(updatePayload).length > 0) {
                    const profiles = await FamilyProfile.filter({ user_id: userId, conversation_id: conversationId });
                    if (profiles && profiles.length > 0) {
                      await FamilyProfile.update(profiles[0].id, updatePayload);
                      console.log('[E42-PERSIST] FamilyProfile updated (EDIT_CRITERIA):', profiles[0].id, Object.keys(updatePayload));
                    }
                  }
                } catch (e) {
                  console.error('[E42-PERSIST] FamilyProfile EDIT_CRITERIA upsert failed (non-blocking):', e.message);
                }
              })();
            }

            // Re-invoke searchSchools with updated profile — build proper search params
            const reSearchParams: any = { limit: 50, familyProfile: workingProfile, conversationId, userId };
            if (workingProfile?.location_area) {
              const locLower = workingProfile.location_area.toLowerCase().trim();
              const metroRegions = ['toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton', 'winnipeg', 'hamilton'];
              const regionAliases = ['gta', 'greater toronto area', 'lower mainland', 'metro vancouver', 'greater vancouver', 'toronto'];
              if (metroRegions.includes(locLower) || regionAliases.includes(locLower)) {
                reSearchParams.region = workingProfile.location_area;
              } else {
                reSearchParams.city = workingProfile.location_area;
              }
            }
            if (workingProfile?.child_grade != null) {
              const g = typeof workingProfile.child_grade === 'number' ? workingProfile.child_grade : parseInt(workingProfile.child_grade);
              if (!isNaN(g)) { reSearchParams.minGrade = g; reSearchParams.maxGrade = g; }
            }
            if (workingProfile?.max_tuition) {
              const t = typeof workingProfile.max_tuition === 'number' ? workingProfile.max_tuition : parseInt(workingProfile.max_tuition);
              if (!isNaN(t)) reSearchParams.maxTuition = t;
            }
            if (userLocation?.lat && userLocation?.lng) {
              reSearchParams.resolvedLat = userLocation.lat;
              reSearchParams.resolvedLng = userLocation.lng;
              reSearchParams.maxDistanceKm = workingProfile?.commute_tolerance_minutes ? Math.ceil(workingProfile.commute_tolerance_minutes / 2) : 75;
            }
            const searchResult = await searchSchoolsLogic(reSearchParams);
            if (searchResult.schools?.length > 0) {
              responseData.schools = searchResult.schools;
              editCriteriaAction.payload.schools = searchResult.schools;
              console.log('[E41-S6] Re-search returned', searchResult.schools.length, 'schools');
            }
          } catch (e) {
            console.error('[E41-S6] EDIT_CRITERIA re-search failed:', e.message);
          }
        }

        // E41-S3: Deferred extractEntities — fire after reply, with aiReply for richer context
        // Skip extraction when going directly to RESULTS via sentinel — profile is already complete
        const skipExtraction = briefJustConfirmed;
        const aiReply = responseData.message || '';
        if (skipExtraction) {
          console.log('[E41-S3] Skipping deferred extractEntities — brief confirmation, profile already built');
        } else {
        // Phase 1c: Dual-write conversation state to normalized table
        syncConversationState(conversationId, userId, responseData.conversationContext || context);

        // E41-S3: Capture promise for waitUntil() instead of fire-and-forget
        const deferredExtraction = extractEntitiesLogic( {
          message: processMessage,
          aiReply,
          conversationFamilyProfile: workingProfile,
          context,
          conversationHistory
        }).then(async (extractResult) => {
          // S3-S5: Delta-only extraction — skip if empty delta
          const delta = extractResult?.extractedEntities || {};
          const deltaFields = Object.keys(delta).filter(k =>
            !['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers'].includes(k)
          );

          const profile = extractResult?.updatedFamilyProfile;
          if (profile) {
            context.accumulatedFamilyProfile = { ...(context.accumulatedFamilyProfile || {}), ...profile };
            console.log('[E41-S3] Deferred extractEntities complete, updated accumulatedFamilyProfile');

            // S3-S5: Only persist if there are actual field changes
            if (deltaFields.length > 0 && userId && conversationId) {
              try {
                const NON_SCHEMA_KEYS = ['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers', 'gender'];
                const PROFILE_FIELDS = [
                  'child_name', 'child_grade', 'child_gender',
                  'location_area', 'max_tuition', 'priorities',
                  'interests', 'dealbreakers', 'learning_differences',
                  'curriculum_preference', 'school_type_label',
                  'academic_strengths', 'parent_notes',
                  'school_gender_exclusions', 'school_gender_preference',
                  // S3-S5: New constraint/preference fields
                  'commute_tolerance', 'schedule_preference', 'homework_tolerance',
                  'open_to_boarding', 'flexible_on_commute',
                ];
                const updatePayload: Record<string, any> = {};
                for (const field of PROFILE_FIELDS) {
                  if (profile[field] !== undefined && profile[field] !== null) {
                    updatePayload[field] = profile[field];
                  }
                }
                for (const key of NON_SCHEMA_KEYS) {
                  delete updatePayload[key];
                }
                if (Object.keys(updatePayload).length > 0) {
                  if (profile.id) {
                    await FamilyProfile.update(profile.id, updatePayload);
                    console.log('[S3-S5] FamilyProfile persisted (RESULTS):', profile.id, 'delta:', deltaFields);
                  } else {
                    const profiles = await FamilyProfile.filter({ user_id: userId, conversation_id: conversationId });
                    if (profiles && profiles.length > 0) {
                      await FamilyProfile.update(profiles[0].id, updatePayload);
                      console.log('[S3-S5] FamilyProfile persisted (RESULTS, lookup):', profiles[0].id, 'delta:', deltaFields);
                    } else {
                      console.warn('[S3-S5] No FamilyProfile found for persist, userId:', userId, 'conversationId:', conversationId);
                    }
                  }
                }
              } catch (e: any) {
                console.error('[S3-S5] FamilyProfile persist failed (non-blocking):', e.message);
              }
            }
          }
        }).catch(e => console.error('[E41-S3] Deferred extractEntities failed (non-critical):', e.message));
        responseData._deferredWork = [deferredExtraction];
        }

        // FIX-RESULTS-HANG: Use `!== undefined` instead of `??` so that explicit
        // `null` from handleResults.ts clears briefStatus.  The `??` operator
        // treats null as nullish, so `null ?? 'confirmed'` kept the overlay stuck.
        // briefStatus removed from stateEnvelope
        stateEnvelope.state = responseData.state !== undefined ? responseData.state : stateEnvelope.state;
        responseData.stateEnvelope = stateEnvelope;
        return (responseData);
      }

      if (currentState === STATES.DEEP_DIVE) {
        // BUG-DEBRIEF-INTENT-S49: Ensure conversationId is in context before debrief handlers
        if (conversationIdFromPayload && !context.conversationId) context.conversationId = conversationIdFromPayload;

        // E13a: Check if debrief mode is set BEFORE falling through to handleDeepDive
        if (resolveResult.deepDiveMode === 'debrief' || resolveResult.flags?.DEBRIEF_MODE) {
          console.log('[E13a] Routing DEEP_DIVE to inlined handleVisitDebrief');
          const debriefResult = await handleVisitDebriefInternal(selectedSchoolId, processMessage, workingProfile, context, consultantName, returningUserContextBlock, callOpenRouter);
          if (debriefResult) {
            if (debriefResult.updatedContext) Object.assign(context, debriefResult.updatedContext);
            // Phase 1c: Dual-write conversation state to normalized table
            syncConversationState(conversationId, userId, context);
            return ({
              message: debriefResult.message,
              state: STATES.DEEP_DIVE,
              briefStatus,
              deepDiveMode: debriefResult.deepDiveMode,
              visitPrepKit: debriefResult.visitPrepKit,
              fitReEvaluation: debriefResult.fitReEvaluation || null,
              familyProfile: workingProfile,
              conversationContext: context,
              extractedEntities: extractionResult?.extractedEntities || {},
              schools: currentSchools || [],
              stateEnvelope: { ...stateEnvelope, state: STATES.DEEP_DIVE } });
          }
          console.log('[E13a] handleVisitDebrief returned null, falling through');
        }

        // E50-S1B: Fetch user's research notes for the selected school (if any)
        const deepDiveSchoolNotes = selectedSchoolId && userId
          ? await fetchSchoolNotes(userId, selectedSchoolId)
          : null;

        const deepDiveResult = await handleDeepDiveLogic( {
          selectedSchoolId,
          message: processMessage,
          conversationFamilyProfile: workingProfile,
          context,
          conversationHistory,
          consultantName,
          currentState,
          briefStatus,
          currentSchools,
          userId,
          returningUserContextBlock,
          flags: resolveResult.flags,
          conversationId,
          userSchoolNotes: deepDiveSchoolNotes
        });
        responseData = deepDiveResult;
        responseData.extractedEntities = extractionResult?.extractedEntities || {};
        // E32-001: Validate and attach actions
        const validSchoolIds_deepdive = new Set((responseData.schools || currentSchools || []).map(s => s.id));
        responseData.actions = responseData.rawToolCalls ? validateActions(responseData.rawToolCalls, validSchoolIds_deepdive, conversationId) : [];
        delete responseData.rawToolCalls;

        // E29-010/E29-012: Fire-and-forget — next action + session summary + totalSessions increment
        fireJourneyUpdate(journeyContext, context, conversationHistory, message, 'DEEP_DIVE');

        // Phase 1c: Dual-write conversation state to normalized table
        syncConversationState(conversationId, userId, responseData.conversationContext || context);

        // FIX-RESULTS-HANG: Use `!== undefined` so explicit null clears briefStatus
        // briefStatus removed from stateEnvelope
        stateEnvelope.state = responseData.state !== undefined ? responseData.state : stateEnvelope.state;
        responseData.stateEnvelope = stateEnvelope;
        return (responseData);
      }

      // S108-WC3 Fix 1 (Post-branch): ensure workingProfile is reflected on any responseData
      // that didn't return early (e.g. unexpected state fallthrough).
      if (responseData) {
        responseData.familyProfile = workingProfile;
        responseData.extractedEntities = workingProfile;
      }

      return ({
        message: 'I encountered an unexpected state. Please try again.',
        state: currentState,
        briefStatus: briefStatus,
        schools: [],
        familyProfile: workingProfile,
        conversationContext: context,
        extractedEntities: extractionResult?.extractedEntities || {},
        stateEnvelope
      });

    } catch (error) {
      console.error('orchestrateConversation FATAL:', error);
      throw error;
    }
  };

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 55000));
  return await Promise.race([processRequest(), timeoutPromise]);
}
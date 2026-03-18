// @ts-nocheck
// Function: resolveTransition
// Purpose: State machine core — determines next state based on intent, profile data, turn count
// Last Modified: 2026-03-18
// Dependencies: None (pure function)

export function resolveTransition(params) {
  let { currentState, intentSignal, profileData, turnCount, briefEditCount, selectedSchoolId, previousSchoolId, userMessage, tier1CompletedTurn: storedTier1CompletedTurn, context } = params;

  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE', JOURNEY_RESUMPTION: 'JOURNEY_RESUMPTION' };

  // Patch 3: Invalid state reset — prevents unknown states from bricking conversations
  if (currentState && !Object.values(STATES).includes(currentState)) {
    console.warn('[RESOLVE] Unknown state detected, resetting to DISCOVERY:', currentState);
    currentState = STATES.DISCOVERY;
  }

  const hasLocation = !!(profileData?.locationArea);
  const hasGrade = profileData?.childGrade !== null && profileData?.childGrade !== undefined;
  const hasBudget = !!(profileData?.maxTuition);
  const prioritiesCount = profileData?.priorities?.length || 0;

  let sufficiency = 'THIN';
  if (hasLocation && hasGrade) {
    sufficiency = prioritiesCount >= 2 ? 'RICH' : 'MINIMUM';
  }

  const flags: Record<string, any> = { SUGGEST_BRIEF: false, OFFER_BRIEF: false, FORCED_TRANSITION: false, USER_INTENT_OVERRIDE: false };
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
      console.log('[EDIT-CRITERIA] Allowing transition from RESULTS to BRIEF for edit-criteria');
      return { nextState: STATES.BRIEF, sufficiency, flags: { ...flags, USER_INTENT_OVERRIDE: true }, briefStatus: 'editing', transitionReason: 'edit_criteria_from_results' };
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

  if (currentState === STATES.WELCOME && turnCount > 0) {
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason: 'auto_welcome_exit' };
  }
  if (selectedSchoolId && selectedSchoolId !== previousSchoolId) {
    return { nextState: STATES.DEEP_DIVE, sufficiency, flags, transitionReason: 'school_selected' };
  }

  // DETERMINISTIC BRIEF CONFIRMATION CHECK - overrides LLM intent classification
  const confirmPhrases = new Set(['that looks right', 'show me schools', 'looks good', 'looks right', 'confirmed', 'yes', 'yep', 'yeah', 'yes please', 'that looks right - show me schools']);
  const msgNormalized = (userMessage || '').toLowerCase().trim();
  const isConfirmed = Array.from(confirmPhrases).some(p => msgNormalized === p || msgNormalized.startsWith(p));
  if (currentState === STATES.BRIEF && params.briefStatus === 'pending_review' && isConfirmed) {
    flags.USER_INTENT_OVERRIDE = true;
    console.log('[DETERMINISTIC] Brief confirmed by match:', userMessage, 'briefStatus was:', params.briefStatus);
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'brief_confirmed_deterministic', briefStatus: 'confirmed' };
  }

  if (currentState === STATES.BRIEF && params.briefStatus === 'pending_review' && (intentSignal === 'confirm-brief' || intentSignal === 'request-results')) {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'brief_confirmed', briefStatus: 'confirmed' };
  }

  // FIX-A: STOP_PHRASES — if user explicitly signals they're done with questions,
  // always route to BRIEF regardless of data sufficiency. Must check BEFORE sufficiency guard.
  const STOP_PHRASES = /\b(no more questions|show me schools|i('m| am) done|enough questions|just show|stop asking|skip|let'?s see|move on|go ahead|that'?s enough|ready to see)\b/i;
  if (currentState === STATES.DISCOVERY && STOP_PHRASES.test(userMessage || '')) {
    flags.USER_INTENT_OVERRIDE = true;
    console.log('[FIX-A] Stop-intent detected, routing to BRIEF regardless of sufficiency:', userMessage);
    return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'stop_intent', briefStatus: 'generating', tier1CompletedTurn };
  }

  // DETERMINISTIC BRIEF PHRASES — explicit phrases that should always route to BRIEF
  const BRIEF_PHRASES = /\b(show me the brief|show my brief|generate the brief|generate my brief|prepare the brief|ready for the brief|let'?s see the brief|create the brief)\b/i;
  if (currentState === STATES.DISCOVERY && BRIEF_PHRASES.test(userMessage || '')) {
    flags.USER_INTENT_OVERRIDE = true;
    console.log('[FIX-BRIEF] Brief-intent phrase detected:', userMessage);
    return {
      nextState: STATES.BRIEF, sufficiency, flags,
      transitionReason: 'brief_phrase_deterministic',
      briefStatus: 'generating', tier1CompletedTurn
    };
  }

  if ((intentSignal === 'request-brief' || intentSignal === 'request-results') && turnCount >= 3 && currentState === STATES.DISCOVERY) {
    if (sufficiency === 'MINIMUM' || sufficiency === 'RICH') {
      flags.USER_INTENT_OVERRIDE = true;
      return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'explicit_demand', briefStatus: 'generating' };
    }
  }
  if (currentState === STATES.DISCOVERY) {
    if (tier1Complete && tier1CompletedTurn !== null && turnCount >= (tier1CompletedTurn + 1)) {
      flags.FORCED_TRANSITION = true;
      return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'enrichment_cap', briefStatus: 'generating', tier1CompletedTurn };
    } else if (turnCount >= 10) {
      flags.FORCED_TRANSITION = true;
      return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'hard_cap', briefStatus: 'generating', tier1CompletedTurn };
    }
  }
  if (intentSignal === 'request-brief' && turnCount < 3 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'explicit_intent', briefStatus: 'generating' };
  }
  // FIX-B: 'request-results' from DISCOVERY now routes to BRIEF (not directly to RESULTS).
  // BRIEF is the mandatory confirmation gate before RESULTS.
  if (intentSignal === 'request-results' && turnCount < 3 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'explicit_intent_via_brief', briefStatus: 'generating' };
  }
  if (intentSignal === 'edit-criteria') {
    flags.USER_INTENT_OVERRIDE = true;
    return { nextState: STATES.BRIEF, sufficiency, flags, transitionReason: 'explicit_intent', briefStatus: 'editing' };
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
  if (currentState === STATES.BRIEF && briefEditCount >= 3) {
    flags.FORCED_TRANSITION = true;
    return { nextState: STATES.RESULTS, sufficiency, flags, transitionReason: 'edit_cap_reached', briefStatus: 'confirmed' };
  }
  return { nextState: currentState, sufficiency, flags, transitionReason };
}

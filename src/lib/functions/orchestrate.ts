// @ts-nocheck
import { FamilyProfile, ChatHistory, FamilyJourney, SchoolJourney, GeneratedArtifact, LLMLog, School } from '@/lib/entities-server'
import { extractEntitiesLogic } from './extractEntities'
import { handleBriefLogic } from './handleBrief'
import { handleResultsLogic } from './handleResults'
import { handleDeepDiveLogic } from './handleDeepDive'
import { generateProfileNarrativeLogic } from './generateProfileNarrative'
import { searchSchoolsLogic } from './searchSchools'
import { STATES, BRIEF_STATUS, resolveGrade, resolveBudget, resolveArrayField } from './constants'

// Extracted modules
import { callOpenRouter } from './callOpenRouter'
import { resolveTransition } from './resolveTransition'
import { lightweightExtract, mergeProfile } from './lightweightExtract'
import { classifyIntentFn, validateActions, ACTION_TOOL_SCHEMA } from './actionValidation'
import { handleDiscovery } from './handleDiscovery'
import { handleVisitDebriefInternal } from './handleVisitDebrief'
import { fireJourneyUpdate } from './fireJourneyUpdate'


// Function: orchestrateConversation
// Purpose: Route chat messages through state machine (WELCOME→DISCOVERY→BRIEF→RESULTS→DEEP_DIVE)
// Entities: FamilyProfile, ChatHistory, FamilyJourney, SchoolJourney, GeneratedArtifact, LLMLog
// Last Modified: 2026-03-18
// Dependencies: OpenRouter API, extractEntities, handleBrief, handleResults, handleDeepDive, processDebriefCompletion
// WC-2: LLM model upgrade — google/gemini-3-flash-preview as primary model in callOpenRouter waterfall

// =============================================================================
// MAIN: orchestrateConversation
// =============================================================================
export async function orchestrateConversationLogic(params: any) {
  const processRequest = async () => {
    var currentState;
    var briefStatus;

    try {
      const { message, conversationHistory, conversationContext, region, userId, consultantName, currentSchools, userLocation, selectedSchoolId, conversationId: conversationIdFromPayload, returningUserContext, journeyContext } = params;

      // WC6: Build RETURNING USER CONTEXT block if present
      let returningUserContextBlock = null;
      if (returningUserContext?.isReturningUser) {
        const contextParts: string[] = [];
        if (returningUserContext.profileName) contextParts.push(`Session: ${returningUserContext.profileName}`);
        if (returningUserContext.childName || returningUserContext.childGrade) {
          const childInfo = returningUserContext.childName
            ? `${returningUserContext.childName}${returningUserContext.childGrade ? `, Grade ${returningUserContext.childGrade}` : ''}`
            : `Grade ${returningUserContext.childGrade}`;
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

      // FIX-C: __CONFIRM_BRIEF__ sentinel goes directly to RESULTS state for immediate school display.
      let context = conversationContext || {};
      let processMessage = message;
      const isConfirmBrief = message === '__CONFIRM_BRIEF__';
      if (isConfirmBrief) {
        processMessage = 'show me schools';
        context.previousState = context.state || 'BRIEF';
        context.state = 'RESULTS';
        context.briefStatus = 'confirmed';
        briefStatus = 'confirmed'; // [E42-PERSIST] sync local var so persist gate fires
        console.log('[FIX-C] __CONFIRM_BRIEF__ sentinel: skipping BRIEF, going directly to RESULTS');
      }

      console.log('ORCH START', {
        messageLength: message?.length,
        conversationHistoryLength: conversationHistory?.length,
        consultant: consultantName,
        userId: userId,
        hasUserLocation: !!userLocation
      });

      const LOCAL_STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE', JOURNEY_RESUMPTION: 'JOURNEY_RESUMPTION' };

      let briefEditCount = context.briefEditCount || 0;
      // BUG-RN-PERSIST Fix B2: Prefer top-level conversationId from payload over
      // context.conversationId which may be stale/null from a previous render cycle.
      const conversationId = conversationIdFromPayload || context.conversationId;

      // STEP 0: Initialize/retrieve FamilyProfile
      let conversationFamilyProfile = null;

      if (userId && conversationId) {
        try {
          const profiles = await FamilyProfile.filter({ userId, conversationId });
          conversationFamilyProfile = profiles.length > 0 ? profiles[0] : null;

          if (!conversationFamilyProfile) {
            conversationFamilyProfile = await FamilyProfile.create({ userId, conversationId });
            console.log('Created new FamilyProfile:', conversationFamilyProfile.id);

            // S141-WC2: E29-HYDRATE — Seed new profile from journey briefSnapshot on session resume
            if (journeyContext?.briefSnapshot) {
              try {
                const snapshot = typeof journeyContext.briefSnapshot === 'string' ? JSON.parse(journeyContext.briefSnapshot) : journeyContext.briefSnapshot;
                const seedFields = ['childName','childGrade','childGender','gender','locationArea','maxTuition','interests','priorities','dealbreakers','curriculumPreference','schoolTypeLabel','academicStrengths'];
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
          childName: null, childGrade: null, locationArea: null, maxTuition: null,
          interests: [], priorities: [], dealbreakers: [], academicStrengths: []
        };
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
        childGrade: conversationFamilyProfile?.childGrade ?? null,
        locationArea: conversationFamilyProfile?.locationArea ?? null,
        maxTuition: conversationFamilyProfile?.maxTuition ?? null,
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
      // E42-FIX: Ensure .id survives merge — Base44 entity .id may be non-enumerable/getter
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
    if (bridgeProfile?.schoolGenderExclusions && Array.isArray(bridgeProfile.schoolGenderExclusions) && bridgeProfile.schoolGenderExclusions.length > 0) {
      workingProfile.schoolGenderExclusions = bridgeProfile.schoolGenderExclusions;
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
      if (context.state === LOCAL_STATES.RESULTS) {
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
        childGrade: conversationFamilyProfile?.childGrade ?? null,
        locationArea: conversationFamilyProfile?.locationArea ?? null,
        maxTuition: conversationFamilyProfile?.maxTuition ?? null,
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
      const inResultsOrDeepDive = context.state === LOCAL_STATES.RESULTS || context.state === LOCAL_STATES.DEEP_DIVE;
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

      if (isFirstMessage && !context.state && !journeyContext?.isResuming) { // S169-WC1: E29-RESUMPTION-FIX    if (!activeJourney?.isResuming) {
    // Initialize first message with consultant's greeting
        console.log('[ORCH] First message, return WELCOME greeting');
        const welcomeMessage = consultantName === 'Jackie'
          ? "Hey there — I'm Jackie. I've worked with hundreds of families going through exactly this. Tell me a bit about your child and what's prompting the search."
          : "Hi, I'm Liam. I'll help you cut through the noise and find schools that actually fit. What's driving the search?";
        return ({
          message: welcomeMessage,
          state: LOCAL_STATES.WELCOME,
          briefStatus: null,
          conversationContext: context,
          familyProfile: conversationFamilyProfile,
          extractedEntities: extractionResult?.extractedEntities || {},
          schools: []
        });
      }

      const profileData = {
        locationArea: workingProfile?.locationArea || null,
        childGrade: workingProfile?.childGrade ?? null,
        maxTuition: workingProfile?.maxTuition || null,
        priorities: workingProfile?.priorities || [],
        dealbreakers: workingProfile?.dealbreakers || [],
        curriculum: workingProfile?.curriculumPreference || [],
        schoolTypeLabel: workingProfile?.schoolTypeLabel || null
      };

      const turnCount = (conversationHistory?.filter(m => m.role === 'user').length || 0) + 1;
      const currentBriefEditCount = context.briefEditCount || 0;
      const previousSchoolId = context.previousSchoolId || null;

      const resolveResult = resolveTransition({
        currentState: context.state || LOCAL_STATES.WELCOME,
        intentSignal,
        profileData,
        turnCount,
        briefEditCount: currentBriefEditCount,
        selectedSchoolId,
        previousSchoolId,
        userMessage: processMessage,
        tier1CompletedTurn: context.tier1CompletedTurn || null,
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
      const previousState = context.state || LOCAL_STATES.WELCOME;
      context.previousState = previousState;

      console.log('[ORCH] resolveTransition:', { nextState: currentState, intentSignal, sufficiency: resolveResult.sufficiency });

      // S136-WC1: E35-REC1 — fire-and-forget for non-RESULTS states
      // E41-S3: RESULTS state defers extraction to post-reply (with aiReply for richer context)
      if (currentState !== LOCAL_STATES.RESULTS) {
        extractEntitiesLogic( {
          message: processMessage,
          conversationFamilyProfile,
          context,
          conversationHistory
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
          schools: []
        });
      }

      context.state = currentState;
      context.briefStatus = briefStatus;
      context.dataSufficiency = resolveResult.sufficiency;
      context.transitionReason = resolveResult.transitionReason;
      if (resolveResult.tier1CompletedTurn !== undefined && resolveResult.tier1CompletedTurn !== null) {
        context.tier1CompletedTurn = resolveResult.tier1CompletedTurn;
      } else if ((resolveResult.flags as any)?.tier1CompletedTurn) {
        context.tier1CompletedTurn = (resolveResult.flags as any).tier1CompletedTurn;
      }

      console.log(`[STATE] ${currentState} | briefStatus: ${briefStatus} | sufficiency: ${context.dataSufficiency} | reason: ${context.transitionReason}`);

      let responseData;

      if (currentState === LOCAL_STATES.DISCOVERY) {
        responseData = await handleDiscovery(processMessage, workingProfile, context, conversationHistory, consultantName, currentSchools, flags, returningUserContextBlock);
        responseData.familyProfile = workingProfile;
        responseData.extractedEntities = workingProfile;
        return (responseData); // DISCOVERY returns early; workingProfile already set above
      }

      if (currentState === LOCAL_STATES.BRIEF) {
        // Change B: If we transitioned directly from DISCOVERY→BRIEF (stop_intent, enrichment_cap, etc.),
        // handleDiscovery was correctly skipped above (currentState !== DISCOVERY). Log for confirmation.
        if (previousState === LOCAL_STATES.DISCOVERY) {
          console.log('[Change-B] DISCOVERY→BRIEF direct transition — handleDiscovery skipped, routing to handleBrief with workingProfile');
        }
        try {
          const briefResult = await handleBriefLogic( {
            message: processMessage,
            localProfile: workingProfile,
            context,
            conversationHistory,
            consultantName,
            briefStatus,
            flags,
            returningUserContextBlock
          });
          responseData = (briefResult as any).data;
          if (responseData.briefStatus) {
            context.briefStatus = responseData.briefStatus;
          }
          if (responseData.conversationContext?.briefStatus) {
            context.briefStatus = responseData.conversationContext.briefStatus;
          }
          responseData.conversationContext = { ...context, ...responseData.conversationContext };
          responseData.extractedEntities = extractionResult?.extractedEntities || {};
          return (responseData);
        } catch (briefError) {
          console.error('[BRIEF] Invocation failed:', briefError.message);
          const fallbackMessage = consultantName === 'Jackie'
            ? "I'm having trouble putting that together right now. Let me try again — could you tell me a bit more about what you're looking for?"
            : "Hit a snag processing your brief. Can you give me a bit more detail on what you're looking for?";
          return ({
            message: fallbackMessage,
            state: LOCAL_STATES.BRIEF,
            briefStatus: 'generating',
            familyProfile: conversationFamilyProfile,
            conversationContext: context,
            extractedEntities: extractionResult?.extractedEntities || {},
            schools: []
          });
        }
      }

      if (currentState === LOCAL_STATES.RESULTS) {
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

        // E13a: Check if debrief mode is set — if so, route to handleVisitDebrief
        if (resolveResult.deepDiveMode === 'debrief') {
          console.log('[E13a] Routing RESULTS->DEBRIEF to handleVisitDebrief');
          const debriefResult = await handleVisitDebriefInternal(selectedSchoolId, processMessage, workingProfile, context, consultantName, returningUserContextBlock);
          if (debriefResult) {
            if (debriefResult.updatedContext) Object.assign(context, debriefResult.updatedContext);
            context.state = LOCAL_STATES.DEEP_DIVE;
            return ({ message: debriefResult.message, state: LOCAL_STATES.DEEP_DIVE, briefStatus, deepDiveMode: debriefResult.deepDiveMode, visitPrepKit: debriefResult.visitPrepKit, fitReEvaluation: debriefResult.fitReEvaluation || null, familyProfile: workingProfile, conversationContext: context, extractedEntities: extractionResult?.extractedEntities || {}, schools: currentSchools || [] });
          }
          console.log('[E13a] handleVisitDebrief returned null, falling through to handleResults');
        }

        // WC10: Fire-and-forget narrative generation (non-blocking)
        const isBriefConfirmedTransition =
          (context.previousState === LOCAL_STATES.BRIEF && briefStatus === 'confirmed') ||
          isConfirmBrief;
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

          // E42-PERSIST Phase 1a: Persist Family Brief as GeneratedArtifact at BRIEF→RESULTS transition
          // Use responseData.message (the just-generated brief) — NOT conversationHistory which doesn't contain it yet.
          if (userId && conversationId) {
            (async () => {
              try {
                const briefText = responseData?.message || '';
                if (!briefText) {
                  console.warn('[E42-PERSIST] No brief text in responseData.message, skipping artifact write');
                  return;
                }
                const existing = await GeneratedArtifact.filter({
                  userId,
                  conversationId,
                  artifactType: 'family_brief'
                });
                const generatedAt = new Date().toISOString();
                const artifactContent = JSON.stringify({ briefText, structuredProfile: workingProfile });
                if (existing && existing.length > 0) {
                  await GeneratedArtifact.update(existing[0].id, {
                    content: artifactContent,
                    generatedAt,
                    metadata: { consultantName: consultantName || 'jackie', version: 'E42_V1' }
                  });
                  console.log('[E42-PERSIST] family_brief updated:', existing[0].id);
                } else {
                  const created = await GeneratedArtifact.create({
                    userId,
                    conversationId,
                    artifactType: 'family_brief',
                    content: artifactContent,
                    generatedAt,
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
        } else if (context.state === LOCAL_STATES.RESULTS) {
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
              const childName = conversationFamilyProfile?.childName || conversationFamilyProfile?.conversationContext?.childName || 'My Child';
              const journey = await FamilyJourney.create({
                userId,
                childName,
                profileLabel: `${childName}'s School Search`,
                currentPhase: 'MATCH',
                phaseHistory: [
                  { phase: 'UNDERSTAND', enteredAt: new Date().toISOString(), completedAt: new Date().toISOString() },
                  { phase: 'MATCH', enteredAt: new Date().toISOString(), completedAt: null }
                ],
                familyProfileId: conversationFamilyProfile?.id || '',
                briefSnapshot,
                consultantId: consultantName || 'jackie',
                schoolJourneys: [],
                totalSessions: 1,
                lastActiveAt: new Date().toISOString(),
                isStale: false,
                isArchived: false
              });
              context.journeyId = journey.id;
              await ChatHistory.update(conversationId, { journeyId: journey.id });
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
          previousSchools: (currentSchools && currentSchools.length > 0) ? currentSchools : (context.lastMatchedSchools || [])
        });
        responseData = resultsResult.data;
        responseData.conversationContext = {
          ...(responseData.conversationContext || {}),
          autoRefreshed: autoRefresh,
          resolvedLat: responseData.resolvedLat || workingProfile?.resolvedLat || null,
          resolvedLng: responseData.resolvedLng || workingProfile?.resolvedLng || null,
        };
        responseData.extractedEntities = extractionResult?.extractedEntities || {};
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
                  const PROFILE_FIELDS = ['childName','childGrade','childGender','locationArea','maxTuition','priorities','interests','dealbreakers','learningDifferences','curriculumPreference','schoolTypeLabel','academicStrengths','parentNotes','schoolGenderExclusions','schoolGenderPreference'];
                  const updatePayload: Record<string, any> = {};
                  for (const key of PROFILE_FIELDS) {
                    if (delta[key] !== undefined && delta[key] !== null) {
                      updatePayload[key] = delta[key];
                    }
                  }
                  if (Object.keys(updatePayload).length > 0) {
                    const profiles = await FamilyProfile.filter({ userId, conversationId });
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

            // Re-invoke searchSchools with updated profile
            const searchResult = await searchSchoolsLogic( {
              familyProfile: workingProfile,
              conversationId,
              userId,
              userLocation
            });
            if (searchResult.data?.schools?.length > 0) {
              responseData.schools = searchResult.data.schools;
              editCriteriaAction.payload.schools = searchResult.data.schools;
              console.log('[E41-S6] Re-search returned', searchResult.data.schools.length, 'schools');
            }
          } catch (e) {
            console.error('[E41-S6] EDIT_CRITERIA re-search failed:', e.message);
          }
        }

        // E41-S3: Deferred extractEntities — fire after reply, with aiReply for richer context
        const aiReply = responseData.message || '';
        extractEntitiesLogic( {
          message: processMessage,
          aiReply,
          conversationFamilyProfile: workingProfile,
          context,
          conversationHistory
        }).then(async (extractResult) => {
          if (extractResult?.data?.updatedFamilyProfile) {
            context.accumulatedFamilyProfile = { ...(context.accumulatedFamilyProfile || {}), ...extractResult.data.updatedFamilyProfile };
            console.log('[E41-S3] Deferred extractEntities complete, updated accumulatedFamilyProfile');

            // E42-PERSIST Phase 1b: Upsert FamilyProfile entity with latest extracted fields
            // This ensures the canonical FamilyProfile in Firestore stays in sync with conversation state.
            if (userId && conversationId) {
              try {
                const delta = extractResult.data.updatedFamilyProfile;
                const PROFILE_FIELDS = ['childName','childGrade','childGender','locationArea','maxTuition','priorities','interests','dealbreakers','learningDifferences','curriculumPreference','schoolTypeLabel','academicStrengths','parentNotes','schoolGenderExclusions','schoolGenderPreference'];
                const updatePayload: Record<string, any> = {};
                for (const key of PROFILE_FIELDS) {
                  if (delta[key] !== undefined && delta[key] !== null) {
                    updatePayload[key] = delta[key];
                  }
                }
                if (Object.keys(updatePayload).length > 0) {
                  const profiles = await FamilyProfile.filter({ userId, conversationId });
                  if (profiles && profiles.length > 0) {
                    await FamilyProfile.update(profiles[0].id, updatePayload);
                    console.log('[E42-PERSIST] FamilyProfile updated:', profiles[0].id, Object.keys(updatePayload));
                  } else {
                    console.warn('[E42-PERSIST] No FamilyProfile found for upsert, userId:', userId, 'conversationId:', conversationId);
                  }
                }
              } catch (e) {
                console.error('[E42-PERSIST] FamilyProfile upsert failed (non-blocking):', e.message);
              }
            }
          }
        }).catch(e => console.error('[E41-S3] Deferred extractEntities failed (non-critical):', e.message));

        return (responseData);
      }

      if (currentState === LOCAL_STATES.DEEP_DIVE) {
        // BUG-DEBRIEF-INTENT-S49: Ensure conversationId is in context before debrief handlers
        if (conversationIdFromPayload && !context.conversationId) context.conversationId = conversationIdFromPayload;

        // E13a: Check if debrief mode is set BEFORE falling through to handleDeepDive
        if (resolveResult.deepDiveMode === 'debrief' || resolveResult.flags?.DEBRIEF_MODE) {
          console.log('[E13a] Routing DEEP_DIVE to handleVisitDebrief');
          const debriefResult = await handleVisitDebriefInternal(selectedSchoolId, processMessage, workingProfile, context, consultantName, returningUserContextBlock);
          if (debriefResult) {
            if (debriefResult.updatedContext) Object.assign(context, debriefResult.updatedContext);
            return ({
              message: debriefResult.message,
              state: LOCAL_STATES.DEEP_DIVE,
              briefStatus,
              deepDiveMode: debriefResult.deepDiveMode,
              visitPrepKit: debriefResult.visitPrepKit,
              fitReEvaluation: debriefResult.fitReEvaluation || null,
              familyProfile: workingProfile,
              conversationContext: context,
              extractedEntities: extractionResult?.extractedEntities || {},
              schools: currentSchools || [] });
          }
          console.log('[E13a] handleVisitDebrief returned null, falling through');
        }

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
          conversationId
        });
        responseData = deepDiveResult.data;
        responseData.extractedEntities = extractionResult?.extractedEntities || {};
        // E32-001: Validate and attach actions
        const validSchoolIds_deepdive = new Set((responseData.schools || currentSchools || []).map(s => s.id));
        responseData.actions = responseData.rawToolCalls ? validateActions(responseData.rawToolCalls, validSchoolIds_deepdive, conversationId) : [];
        delete responseData.rawToolCalls;

        // E29-010/E29-012: Fire-and-forget — next action + session summary + totalSessions increment
        fireJourneyUpdate(journeyContext, context, conversationHistory, message, 'DEEP_DIVE');

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
        extractedEntities: extractionResult?.extractedEntities || {}
      });

    } catch (error) {
      console.error('orchestrateConversation FATAL:', error);
      throw error;
    }
  };

  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 45000));
  return await Promise.race([processRequest(), timeoutPromise]);
}

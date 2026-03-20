// ─── Ownership Boundary (Phase 3b) ───────────────────────────────────
// Conversation state (currentConversation, conversations, briefStatus,
// onboardingPhase, currentView, sessionId, sessionRestored) is owned by
// useConversationState hook. This handler receives setters via props and
// performs message-level persistence (ChatHistory.update for messages +
// context). Conversation CRUD (load, create, switch, delete) is handled
// by useConversationState — this handler only calls loadConversations
// (provided via props) for sidebar refresh after title generation.
// ─────────────────────────────────────────────────────────────────────

import { STATES, BRIEF_STATUS } from '@/lib/stateMachineConfig';
import { validateBriefContent, generateProgrammaticBrief } from '@/components/utils/briefUtils';
import { extractAndSaveMemories } from '@/components/utils/memoryManager';
import { createConversation, updateConversation } from '@/lib/api/conversations';
import { createSession, updateSession } from '@/lib/api/sessions';
import { invokeFunction } from '@/lib/functions';
import { retryWithBackoff } from '@/components/utils/retryWithBackoff';
import { useRef, useEffect } from 'react';
import { useConversationState as useStateEnvelope } from '@/hooks/useConversationState';

export const useMessageHandler = ({
  messages,
  setMessages,
  selectedConsultant,
  sessionId,
  isAuthenticated,
  setShowLoginGate,
  currentConversation,
  familyProfile,
  briefStatus,
  setBriefStatus,
  extractedEntitiesData,
  setExtractedEntitiesData,
  isPremium,
  tokenBalance,
  setTokenBalance,
  user,
  setUser,
  shortlistData,
  schools,
  setSchools,
  selectedSchool,
  setSelectedSchool,
  setCurrentView,
  onboardingPhase,
  restoredSessionData,
  setCurrentConversation,
  setIsTyping,
  setLastTypingTime,
  setFamilyProfile,
  setSchoolsAnimKey,
  setDeepDiveAnalysis,
  setVisitPrepKit,
  setActionPlan,
  setFitReEvaluation,
  artifactCache,
  resetSort,
  loadShortlist,
  loadConversations,
  userLocation,
  setFeedbackPromptShown,
  feedbackPromptShown,
  isDevMode,
  setShowUpgradeModal,
  trackEvent,
  mapStateToView,
  activeJourney,
  setActiveJourney,
  // E41: Action dispatch deps for S6/S7/S10
  setFilterOverrides,
  resetFilterOverrides,
  loadMoreSchools,
  setActivePanel,
  applyDistances,
  // E47: FamilyBrief from guided intro for pre-extracted entity injection
  familyBrief,
  // E48-FIX: Ref to read latest familyBrief even in stale closures
  familyBriefRef,
}, isPremiumParam = isPremium) => {
    // BUG-RN-PERSIST Fix 1: Ref tracks the latest conversationId immediately,
    // bypassing React's batched state updates so deep dive closures always get the real id.
    const conversationIdRef = useRef(currentConversation?.id || null);
    useEffect(() => {
      conversationIdRef.current = currentConversation?.id || null;
    }, [currentConversation?.id]);

    // P4-S4.5: Wire stateEnvelope hook — single source of truth for state/briefStatus
    const {
      state: envelopeState,
      briefStatus: envelopeBriefStatus,
      updateFromResponse,
    } = useStateEnvelope();

    // Sync hook's briefStatus → Phase 3b setBriefStatus for ongoing renders
    useEffect(() => {
      if (envelopeBriefStatus !== undefined && envelopeBriefStatus !== briefStatus) {
        setBriefStatus(envelopeBriefStatus);
      }
    }, [envelopeBriefStatus]);

    // CRT-S109-F15: Message queue to prevent message loss during rapid input
    let isProcessing = false;
    const messageQueue = [];
    let lastResolvedSchoolId = null;
    
    const processQueuedMessages = async () => {
      while (messageQueue.length > 0 && !isProcessing) {
        const { messageText, explicitSchoolId, displayText } = messageQueue.shift();
        await handleSendMessage(messageText, explicitSchoolId, displayText);
      }
    };

  const handleSendMessage = async (messageText, explicitSchoolId = null, displayText = null) => {
        // CRT-S109-F15: Queue messages if already processing
    if (isProcessing) {
      console.log('[CRT-S109] Queueing message: "' + messageText.substring(0, 30) + '..."');
      messageQueue.push({ messageText, explicitSchoolId, displayText });
      return;
    }
    isProcessing = true;
    // Track message sent
    invokeFunction('trackSessionEvent', {
      eventType: 'message_sent',
      consultantName: selectedConsultant,
      sessionId
    }).catch(err => console.error('Failed to track:', err));

    // E47: __GUIDED_INTRO_COMPLETE__ is a synthetic trigger — skip login gate, don't display as user message
    const isGuidedIntroComplete = messageText === '__GUIDED_INTRO_COMPLETE__';

    // SOFT LOGIN GATE: Check if user is confirming the Brief without being logged in
    const isBriefConfirmation = messageText === '__CONFIRM_BRIEF__' ||
                                 messageText.toLowerCase().includes("that's right") ||
                                 messageText.toLowerCase().includes("let's see the schools") ||
                                 messageText.toLowerCase().includes("see the schools") ||
                                 messageText.toLowerCase().includes("that looks right") ||
                                 messageText.toLowerCase().includes("show me schools");

    // BUG-BRIEF-DUPE: Immediately lock briefStatus to confirmed so chips disappear before response arrives
    if (messageText === '__CONFIRM_BRIEF__' || isGuidedIntroComplete) {
      setBriefStatus('confirmed');
    }

    if (isBriefConfirmation && !isGuidedIntroComplete && !isAuthenticated && !isDevMode) {
      // Save current conversation data to localStorage before showing gate
      localStorage.setItem('guestConversationData', JSON.stringify({
        messages,
        consultant: selectedConsultant,
        conversationContext: currentConversation?.conversation_context || {},
        familyProfile: familyProfile || {},
        briefStatus: briefStatus || null,
        extractedEntitiesData: extractedEntitiesData || {},
        sessionId
      }));

      // FIX-RESULTS-VIEW: Show login gate as non-blocking overlay but do NOT
      // return early. The API call proceeds so schools load behind the modal.
      // When the user closes the modal, they see the RESULTS view with schools.
      setShowLoginGate(true);
    }

    // Check if user has tokens (skip for premium)
    if (!isPremium && tokenBalance <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    // Add user message (suppress guided intro sentinel from chat display)
    const userMessage = isGuidedIntroComplete ? null : {
      role: 'user',
      content: displayText || messageText,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = userMessage ? [...messages, userMessage] : [...messages];
    setMessages(updatedMessages);
    setIsTyping(true);
    setLastTypingTime(Date.now());

    try {
      // CRITICAL FIX: When confirming brief, pass empty array to force fresh search
      const isBriefConfirmingForResults = isBriefConfirmation ||
                                          (briefStatus === BRIEF_STATUS.PENDING_REVIEW &&
                                           (messageText.toLowerCase().includes('show') ||
                                            messageText.toLowerCase().includes('right')));

      // WC6: Build returning user context if session was restored
      let returningUserContext = null;
      if (restoredSessionData && familyProfile) {
        const shortlistedSchoolNames = shortlistData.map(s => s.name).slice(0, 5);
        const lastActive = restoredSessionData.updatedDate
          ? new Date(restoredSessionData.updatedDate).toLocaleDateString()
          : null;

        returningUserContext = {
          isReturningUser: true,
          childName: familyProfile.child_name,
          childGrade: familyProfile.child_grade,
          location: familyProfile.location_area,
          budget: familyProfile.max_tuition ? `$${familyProfile.max_tuition.toLocaleString()}` : null,
          priorities: familyProfile.priorities?.join(', ') || null,
          matchedSchoolsCount: restoredSessionData.matchedSchoolsCount || 0,
          shortlistedSchools: shortlistedSchoolNames,
          lastActive: lastActive,
          profileName: restoredSessionData.profileName,
          consultantName: restoredSessionData.consultantName
        };
      }

    // CRT-S109-F16: Detect school switch from natural language
    let resolvedSchoolId = explicitSchoolId;
    if (!resolvedSchoolId && schools?.length) {
          const currentSchoolId = selectedSchool?.id || lastResolvedSchoolId;
      const msgLower = messageText.toLowerCase();
      const matchedSchool = schools
            .filter(s => s.id !== currentSchoolId && s.name)
        .sort((a, b) => b.name.length - a.name.length)
        .find(s => msgLower.includes(s.name.toLowerCase()));
      if (matchedSchool) { resolvedSchoolId = matchedSchool.id; }
    }
    if (resolvedSchoolId && resolvedSchoolId !== explicitSchoolId) { lastResolvedSchoolId = resolvedSchoolId; }
      // Call orchestrateConversation with current schools context and user location
      const response = await invokeFunction('orchestrateConversation', {
        message: messageText,
        conversationHistory: messages.slice(-10),
        conversationContext: currentConversation?.conversation_context || {},
        region: user?.profileRegion || 'Canada',
        userId: user?.id,
        consultantName: selectedConsultant,
        currentOnboardingPhase: onboardingPhase,
        currentSchools: isBriefConfirmingForResults ? [] : schools,
        userLocation: userLocation ? {
          lat: userLocation.lat,
          lng: userLocation.lng,
          address: userLocation.address
        } : null,
            selectedSchoolId: resolvedSchoolId || lastResolvedSchoolId || selectedSchool?.id || null,
        conversationId: (typeof conversationIdRef.current === 'string' && conversationIdRef.current.length > 0) ? conversationIdRef.current : (() => { console.warn('[E42-GUARD] Invalid conversationIdRef.current, using null:', conversationIdRef.current); return null; })(),
        returningUserContext,
        ...(restoredSessionData && activeJourney ? { journeyContext: activeJourney } : {}),
        // E47: Pass familyBrief as pre-extracted entities so backend skips collection
        // E48-FIX: Prefer ref value over state to avoid stale closure when called
        // from handleGuidedIntroComplete's setTimeout before React re-renders.
        ...((familyBriefRef?.current || familyBrief) ? { familyBrief: familyBriefRef?.current || familyBrief } : {})
      });

      // DEFENSIVE CHECK: Ensure response.data exists
      if (!response?.data) {
        throw new Error('Orchestration response contained no data');
      }

      // P4-S4.5: Feed stateEnvelope hook — extracts state/briefStatus from
      // stateEnvelope (preferred) with automatic fallback to flat fields.
      updateFromResponse(response.data);

      // P4-S4.5: Extract state early so all downstream logic is stateEnvelope-aware.
      // Prefer stateEnvelope.state, fall back to flat response.data.state.
      const responseState = response.data?.stateEnvelope?.state || response.data?.state;

      console.log('[CARD DEBUG]', Object.keys(response.data || {}), response.data?.deepDiveAnalysis, response.data?.visitPrepKit);

      // T043: Update familyProfile live from orchestration response — merge to accumulate multi-turn data
      if (response.data?.familyProfile) {
        setFamilyProfile(prev => ({ ...(prev || {}), ...response.data.familyProfile }));
      }

      // DEEPDIVE: Store structured analysis card data
      // Only update if a new one is returned; only clear when leaving DEEP_DIVE state entirely
      if (response.data?.deepDiveAnalysis) {
        const diveSchoolId = response.data?.deepDiveAnalysis?.schoolId || resolvedSchoolId || explicitSchoolId || selectedSchool?.id || null;
        setDeepDiveAnalysis({ ...response.data.deepDiveAnalysis, schoolId: diveSchoolId });
      } else if (responseState === 'DEEP_DIVE' && response.data?.deepDiveAnalysis === null && artifactCache && selectedSchool?.id) {
        // WC6: Hydrate from cache if no new analysis in DEEP_DIVE state
        const cacheKey = `${selectedSchool.id}_deep_dive_analysis`;
        if (artifactCache[cacheKey]) {
          console.log('[WC6] Hydrating deepDiveAnalysis from cache');
          setDeepDiveAnalysis(artifactCache[cacheKey]);
        }
      } else if (responseState !== 'DEEP_DIVE') {
        setDeepDiveAnalysis(null);
      }
      // do NOT clear deepDiveAnalysis when state stays DEEP_DIVE but no new analysis returned

      // Visit Prep Kit: same — only set when returned, only clear when leaving DEEP_DIVE
      if (response.data?.visitPrepKit) {
        const prepSchoolId = response.data?.visitPrepKit?.schoolId || resolvedSchoolId || explicitSchoolId || selectedSchool?.id || null;
        if (!isPremium) {
          setVisitPrepKit({ __gated: true, schoolName: response.data.visitPrepKit.schoolName || 'this school', schoolId: prepSchoolId });
        } else {
          setVisitPrepKit({ ...response.data.visitPrepKit, schoolId: prepSchoolId });
        }
      } else if (responseState === 'DEEP_DIVE' && response.data?.visitPrepKit === null && artifactCache && selectedSchool?.id) {
        // WC6: Hydrate from cache if no new visit prep kit in DEEP_DIVE state
        const cacheKey = `${selectedSchool.id}_visit_prep`;
        if (artifactCache[cacheKey]) {
          console.log('[WC6] Hydrating visitPrepKit from cache');
          if (!isPremium) {
            setVisitPrepKit({ __gated: true, schoolName: artifactCache[cacheKey].schoolName || selectedSchool?.name || 'this school', schoolId: selectedSchool.id });
          } else {
            setVisitPrepKit({ ...artifactCache[cacheKey], schoolId: selectedSchool.id });
          }
        }
      } else if (responseState !== 'DEEP_DIVE') {
        setVisitPrepKit(null);
      }

      // E28-S3 WC2: Action Plan capture
      if (response.data?.actionPlan) {
        setActionPlan(response.data.actionPlan);
      } else if (responseState !== 'DEEP_DIVE') {
        setActionPlan(null);
      }

      // Fit Re-Evaluation: only set when returned, only clear when leaving DEEP_DIVE
      if (response.data?.fitReEvaluation) {
        if (!isPremium) {
          setFitReEvaluation({ __gated: true, schoolName: response.data.fitReEvaluation.schoolName || '' });
        } else {
          setFitReEvaluation(response.data.fitReEvaluation);
        }
      } else if (responseState === 'DEEP_DIVE' && response.data?.fitReEvaluation === null && artifactCache && selectedSchool?.id) {
        // WC6: Hydrate from cache if no new fit re-evaluation in DEEP_DIVE state
        const cacheKey = `${selectedSchool.id}_fit_reevaluation`;
        if (artifactCache[cacheKey]) {
          console.log('[WC6] Hydrating fitReEvaluation from cache');
          if (!isPremium) {
            setFitReEvaluation({ __gated: true, schoolName: artifactCache[cacheKey].schoolName || selectedSchool?.name || '' });
          } else {
            setFitReEvaluation(artifactCache[cacheKey]);
          }
        }
      } else if (responseState !== 'DEEP_DIVE') {
        setFitReEvaluation(null);
      }

      // Store extractedEntities from response for FamilyBrief fallback display — merge to accumulate multi-turn data
      if (response.data?.extractedEntities) {
        setExtractedEntitiesData(prev => ({ ...(prev || {}), ...response.data.extractedEntities }));
        console.log('[BUDGET FIX] Stored extractedEntities:', response.data.extractedEntities);
      }

      // T047: If matches were auto-refreshed, bump animation key to trigger fade/reorder
      if (response.data?.conversationContext?.autoRefreshed === true) {
        setSchoolsAnimKey(k => k + 1);
      }

      // CRITICAL: Update briefStatus from response immediately.
      // BUG-OVERLAY-002/003 FIX: When RESULTS arrive, clear briefStatus in BOTH local
      // state AND the context that gets stored in conversationContext. If we only clear
      // the local state, the sync effect (Consultant.jsx FIX 17) reads 'confirmed' from
      // context and reverses the clearing — causing the overlay to stay stuck forever.
      // P4-S4.5: Prefer stateEnvelope fields, fall back to flat response fields
      let newBriefStatus = response.data?.stateEnvelope?.briefStatus ?? response.data?.briefStatus ?? null;
      // FIX-RESULTS-HANG: Always clear briefStatus when transitioning to RESULTS,
      // regardless of school count or confirmation flags.  The overlay must dismiss
      // even when zero schools match the search criteria.
      if (responseState === STATES.RESULTS) {
        newBriefStatus = null;
        setBriefStatus(null);
        console.log('[BRIEF STATUS] Cleared on RESULTS arrival');
      } else if (newBriefStatus) {
        setBriefStatus(newBriefStatus);
        console.log('[BRIEF STATUS] Updated to:', newBriefStatus);
      }

      // CRITICAL FIX: Merge backend's full context (including extractedEntities) with frontend state
      const deepDiveSchoolId = response.data?.deepDiveAnalysis?.schoolId || selectedSchool?.id || resolvedSchoolId || null;
      const prevContext = currentConversation?.conversation_context || {};
      // PHASE-1FG: Removed 'schools' from context writes — schools are now written
      // exclusively to conversation_schools via dualWrite.ts
      const updatedContext = {
        ...prevContext,
        ...(response.data?.conversationContext || {}),
        state: responseState,
        briefStatus: newBriefStatus,
        conversationId: conversationIdRef.current || currentConversation?.id || null,
        resumeView: responseState || null,
        lastDeepDiveSchoolId: (responseState === 'DEEP_DIVE' || deepDiveSchoolId) ? deepDiveSchoolId : (prevContext?.lastDeepDiveSchoolId || null),
      };
      console.log('[PHASE-1FG] conversation_context assembled without schools key');

      // BUG-RN-PERSIST Fix A: Use functional updater to avoid stale-closure overwrite
      // of currentConversation.id that was set by the RESULTS ChatHistory.create block.
      setCurrentConversation(prev => ({
        ...(prev || { id: null, messages: [] }),
        conversation_context: updatedContext,
      }));

      // E42-PERSIST: Primary conversation_context persist (non-blocking)
      if (typeof conversationIdRef.current === 'string' && conversationIdRef.current) {
        retryWithBackoff(() => updateConversation(conversationIdRef.current, { conversation_context: updatedContext })).catch(err => console.error('[E42-PERSIST] Primary context save failed:', err));
      }

      // BUG-DD-001 FIX: selectedSchool is SINGLE SOURCE OF TRUTH - NEVER clear it based on AI state
      const responseTargetSchoolId = response.data?.deepDiveAnalysis?.schoolId || resolvedSchoolId || explicitSchoolId;
      const isSchoolSwitch = responseTargetSchoolId && responseTargetSchoolId !== selectedSchool?.id;
      const isViewingSchoolDetail = selectedSchool !== null && !isSchoolSwitch;

      if (isSchoolSwitch && responseTargetSchoolId) {
        const responseSchools = response.data?.schools || [];
        const switchTarget = responseSchools.find(s => s.id === responseTargetSchoolId);
        if (switchTarget && setSelectedSchool) {
          setSelectedSchool(switchTarget);
        }
        if (response.data?.deepDiveAnalysis && setDeepDiveAnalysis) {
          setDeepDiveAnalysis({ ...response.data.deepDiveAnalysis, schoolId: responseTargetSchoolId });
        }
      }

      if (responseState === STATES.RESULTS) {
        // RESULTS always transitions view — clear any stale selectedSchool from prior session restore
        if (setSelectedSchool) setSelectedSchool(null);
        setCurrentView(mapStateToView(STATES.RESULTS));
      } else if (!isViewingSchoolDetail && responseState) {
        // Only update view if NOT viewing a school detail
        // CRITICAL: Do NOT call setSelectedSchool(null) here - it defeats the single source of truth
        setCurrentView(mapStateToView(responseState));
      } else if (!isViewingSchoolDetail && !responseState) {
        console.warn('[WARN] Missing state from response:', responseState);
      } else if (isViewingSchoolDetail) {
        console.log('[BUG-DD-001] Maintaining detail view - school selected:', selectedSchool?.name);
        // Keep view locked to detail as long as selectedSchool is set
      }

      // Use the same guard for schools display logic
      const isDeepDivingSchool = isViewingSchoolDetail;

      // FIX #3: First priority - if schools are returned, display them (ONLY if not in DEEP_DIVE)
      if ((response.data?.schools || []).length > 0 && (!isDeepDivingSchool || responseState === STATES.RESULTS)) {
        // Track schools shown
        trackEvent('schools_shown', { metadata: { schoolCount: (response.data?.schools || []).length } });

        // Show feedback prompt if not already shown
        if (!feedbackPromptShown && messages.length > 5) {
          setFeedbackPromptShown(true);
        }
        // Reorder schools to match the order mentioned in AI response
        const aiResponse = response.data?.message || '';
        const orderedSchools = [...(response.data?.schools || [])].filter(Boolean);

        const mentionedSchools = [];
        const remainingSchools = [];

        for (const school of orderedSchools) {
          const schoolNameIndex = aiResponse.indexOf(school.name);
          if (schoolNameIndex !== -1) {
            mentionedSchools.push({ school, index: schoolNameIndex });
          } else {
            remainingSchools.push(school);
          }
        }

        mentionedSchools.sort((a, b) => a.index - b.index);

        const finalOrderedSchools = [
          ...mentionedSchools.map(ms => ms.school),
          ...remainingSchools
        ];

        setSchools(finalOrderedSchools);
        // Reset sort to relevance when new schools arrive
        resetSort();
        // BUG-DD-001 FIX: View switching handled in state mapping logic above
      }

      // Create ChatSession when brief is confirmed and transitioning to RESULTS
      if (responseState === STATES.RESULTS) {
        try {
          const matchedSchoolIds = (response.data?.schools || []).map(s => s.id).filter(id => id != null);
          const profileForSession = response.data?.familyProfile || familyProfile;
          const profileName = profileForSession?.child_name
            ? `${profileForSession.child_name}'s School Search Profile`
            : 'School Search Profile';

          // Ensure a ChatHistory record exists for URL-based flow
          let chatHistoryRecord = null;
          if ((!currentConversation?.id) && isAuthenticated && user) {
            try {
              chatHistoryRecord = await createConversation({
                user_id: user.id,
                title: profileName,
                messages: updatedMessages,
                conversation_context: updatedContext,
                is_active: true
              });
              // BUG-RN-PERSIST Fix A2 + Fix 1: Patch both updatedContext and the ref immediately
              // so that deep dive closures read the real id without waiting for React re-render.
              if (typeof chatHistoryRecord.id === 'string' && chatHistoryRecord.id.length > 0) {
                updatedContext.conversationId = chatHistoryRecord.id;
                conversationIdRef.current = chatHistoryRecord.id;
              } else {
                console.warn('[E42-GUARD] Invalid chatHistoryRecord.id, skipping ref assignment:', chatHistoryRecord.id);
              }
              setCurrentConversation(prev => ({ ...(prev || {}), ...chatHistoryRecord, conversation_context: updatedContext }));
              console.log('[SESSION] Created ChatHistory with id:', chatHistoryRecord.id);
            } catch (e) {
              console.error('Failed to create ChatHistory before ChatSession:', e);
            }
          }

          // BUG-LOCATION-EXTRACT-S97 FIX: Prefer extractedEntities.locationArea over profileForSession
          // to avoid stale/invalid values (e.g. 'Grade') stored on the profile before isInvalidLocation correction
          const safeLocationArea = response.data?.extractedEntities?.location_area || extractedEntitiesData?.location_area || profileForSession?.location_area;

          // E48-S3: Null guard — skip ChatSession create if user is not authenticated
          let chatSessionResult = null;
          if (!user?.id) {
            console.warn('[E48-S3] Skipping ChatSession.create — user.id is falsy:', user);
          } else {
            // E48-S5: Check for existing ChatSession to prevent duplicates on criteria re-match
            const existingChatSessionId = currentConversation?.conversation_context?.chatSessionId;
            if (existingChatSessionId) {
              // Second RESULTS for same conversation — update existing row
              console.log('[E48-S5] Updating existing ChatSession:', existingChatSessionId);
              await updateSession(existingChatSessionId, {
                matched_schools: JSON.stringify(matchedSchoolIds),
                child_name: profileForSession?.child_name,
                child_grade: profileForSession?.child_grade,
                location_area: safeLocationArea,
                max_tuition: profileForSession?.max_tuition,
                priorities: profileForSession?.priorities,
                profile_name: profileName,
                status: 'active',
              });
              chatSessionResult = { id: existingChatSessionId };
            } else {
              // First RESULTS — create new ChatSession
              chatSessionResult = await createSession({
                session_token: sessionId,
                user_id: user.id,
                family_profile_id: profileForSession?.id || null,
                chat_history_id: chatHistoryRecord?.id || currentConversation?.id,
                status: 'active',
                consultant_selected: selectedConsultant,
                child_name: profileForSession?.child_name,
                child_grade: profileForSession?.child_grade,
                location_area: safeLocationArea,
                max_tuition: profileForSession?.max_tuition,
                priorities: profileForSession?.priorities,
                matched_schools: JSON.stringify(matchedSchoolIds),
                profile_name: profileName,
                journey_id: null,
              });
              // E48-S5: Store chatSessionId in conversation_context to prevent duplicates
              if (chatSessionResult?.id) {
                updatedContext.chatSessionId = chatSessionResult.id;
                setCurrentConversation(prev => ({
                  ...prev,
                  conversation_context: {
                    ...(prev?.conversation_context || {}),
                    chatSessionId: chatSessionResult.id,
                    // FIX-RACE: Explicitly re-assert briefStatus: null on RESULTS.
                    // Without this, React batching spreads prev.conversation_context
                    // which still has briefStatus: 'confirmed' from the prior render,
                    // overwriting the null that was set earlier in this handler.
                    briefStatus: null,
                  },
                }));
              }
            }

            // Update URL with entity id (not sessionToken)
            if (chatSessionResult?.id && typeof chatSessionResult.id === 'string') {
              const newUrl = `/consultant?sessionId=${chatSessionResult.id}`;
              window.history.replaceState({}, document.title, newUrl);
              console.log('[SESSION] ChatSession id:', chatSessionResult.id);
            } else {
              console.warn('[WARN] Invalid chatSession id — skipping URL update:', chatSessionResult?.id);
            }
          }

          // E29-003: Auto-create FamilyJourney at Brief confirmation
          ;(async () => {
            if (!user?.id) return;
            try {
              const existingRes = await fetch(`/api/family-journey?user_id=${user.id}&is_archived=false`);
              const existingJourneys = existingRes.ok ? await existingRes.json() : [];
              // Also fetch archived to check total — but the API already filters, so
              // we only need the active list to decide whether to create
              const activeJourneyList = existingJourneys;
              if (activeJourneyList.length === 0) {
                const childName = profileForSession?.child_name || 'My Child';
                const createRes = await fetch('/api/family-journey', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    user_id: user.id,
                    child_name: childName,
                    profile_label: childName + "'s School Search",
                    current_phase: 'MATCH',
                    phase_history: JSON.stringify([
                      { phase: 'UNDERSTAND', enteredAt: new Date().toISOString(), completedAt: new Date().toISOString() },
                      { phase: 'MATCH', enteredAt: new Date().toISOString() }
                    ]),
                    family_profile_id: familyProfile?.id || null,
                    brief_snapshot: JSON.stringify(profileForSession || {}),
                    consultant_id: selectedConsultant || 'jackie',
                    total_sessions: 1,
                    is_archived: false,
                    last_active_at: new Date().toISOString(),
                  }),
                });
                const newJourney = createRes.ok ? await createRes.json() : null;
                if (!newJourney) throw new Error('Failed to create FamilyJourney');
                console.log('[E29-003] FamilyJourney created:', newJourney.id);
                if (typeof setActiveJourney === 'function') {
                  setActiveJourney(newJourney);
                }
                if (chatSessionResult?.id && newJourney?.id) {
                  updateSession(chatSessionResult.id, { journey_id: newJourney.id }).catch(e => console.error('[E29-003] Failed to link ChatSession:', e));
                }
              } else {
                console.log('[E29-003] Active FamilyJourney already exists, skipping creation. Journey ID:', activeJourneyList[0].id);
                if (typeof setActiveJourney === 'function' && !activeJourney) {
                  setActiveJourney(activeJourneyList[0]);
                }
              }
            } catch (e) {
              console.error('[E29-003] FamilyJourney creation failed:', e.message);
            }
          })();
        } catch (sessionError) {
          console.error('Failed to create ChatSession:', sessionError);
        }
      }

      // KI-52: Brief content validator — swap thin LLM brief for programmatic fallback
      // DOUBLE-BRIEF FIX: Only apply when the RESPONSE state is also BRIEF (not when transitioning to RESULTS)
      let aiMessageContent = response.data?.message || 'Here are your school matches based on your preferences.';
      if (responseState === STATES.BRIEF) {
        const latestProfile = response.data?.familyProfile || familyProfile;
        const isEditingBrief = response.data?.briefStatus === 'editing' || response.data?.conversationContext?.briefStatus === 'editing';
        if (!isEditingBrief && !validateBriefContent(aiMessageContent)) {
          const fallback = generateProgrammaticBrief(latestProfile);
          if (fallback) {
            console.warn('[KI-52] Brief failed validation — using programmatic fallback');
            aiMessageContent = fallback;
          }
        }
      }

      const analyzedSchoolId = explicitSchoolId || response.data?.deepDiveAnalysis?.schoolId || selectedSchool?.id || null;

      // E49-S3B: Use chat_summary as the assistant message body when deep-dive provides it
      if (response.data?.deepDiveAnalysis?.chat_summary) {
        aiMessageContent = response.data.deepDiveAnalysis.chat_summary;
      }

      const aiMessage = {
        role: 'assistant',
        content: aiMessageContent,
        timestamp: new Date().toISOString(),
        deepDiveAnalysis: response.data?.deepDiveAnalysis ? { ...response.data.deepDiveAnalysis, schoolId: analyzedSchoolId } : null,
        visitPrepKit: response.data?.visitPrepKit
          ? { ...response.data.visitPrepKit, schoolId: analyzedSchoolId }
          : null,
        actionPlan: response.data?.actionPlan
          ? { ...response.data.actionPlan, schoolId: analyzedSchoolId }
          : null,
        fitReEvaluation: response.data?.fitReEvaluation
          ? { ...response.data.fitReEvaluation, schoolId: analyzedSchoolId }
          : null,
        actions: response.data?.actions || [],
      };

      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      // E41: Inline dispatch for RESULTS-state chat actions (S6/S7/S10)
      // Fires synchronously so state updates land in the same render as setSchools/setIsTyping.
      // Note: ADD_TO_SHORTLIST / EXPAND_SCHOOL / INITIATE_TOUR are handled in Consultant.jsx
      // useEffect (intentionally outside this hook per E30-012 stale-closure guidance).
      for (const action of (response.data?.actions || [])) {
        switch (action.type) {
          case 'EDIT_CRITERIA':
            // E41-S6: Update grid with refreshed schools from inline re-search
            if (action.payload?.schools?.length > 0) {
              setSchools(action.payload.schools);
              resetSort();
            }
            setSchoolsAnimKey(k => k + 1);
            break;
          case 'FILTER_SCHOOLS': {
            const f = action.payload?.filters || {};
            if (f.clear) {
              resetFilterOverrides?.();
            } else {
              const mapped = {};
              if (f.boardingType === 'boarding') mapped.boardingOnly = true;
              else if (f.boardingType === 'day') mapped.boardingOnly = false;
              if (f.gender) mapped.genderFilter = f.gender === 'coed' ? 'co-ed' : f.gender;
              if (f.curriculum) mapped.curriculum = f.curriculum;
              if (f.religiousAffiliation) mapped.religiousAffiliation = f.religiousAffiliation;
              setFilterOverrides?.(prev => ({ ...prev, ...mapped }));
            }
            break;
          }
          case 'LOAD_MORE':
            loadMoreSchools?.();
            break;
          case 'SORT_SCHOOLS': {
            const sortBy = action.payload?.sortBy || 'distance';
            if (sortBy === 'distance' && userLocation && applyDistances) {
              const sorted = applyDistances(userLocation, schools);
              if (sorted?.length) setSchools(sorted);
            }
            break;
          }
          case 'OPEN_PANEL':
            setActivePanel?.(action.payload?.panel);
            break;
          default:
            break;
        }
      }

      // Non-fatal bookkeeping — runs after user-facing response is delivered
      // Errors here are logged but never shown to the user
      (async () => {
        // CRITICAL: Persist messages to ChatHistory FIRST — this is the primary
        // data survival path. Must run before any other bookkeeping that might throw.
        if (isAuthenticated && typeof currentConversation?.id === 'string' && currentConversation.id.length > 0) {
          try {
            await retryWithBackoff(() => updateConversation(currentConversation.id, {
              messages: finalMessages,
              conversation_context: updatedContext
            }));
          } catch (persistErr) {
            console.error('[PERSIST] ChatHistory.update failed — messages may be lost on refresh:', persistErr);
          }

          // Title generation and summarization (non-critical)
          try {
            const userMessageCount = finalMessages.filter(m => m.role === 'user').length;

            if (userMessageCount === 1 && currentConversation.title === 'New Conversation') {
              try {
                const titleResult = await invokeFunction('generateConversationTitle', {
                  conversationId: currentConversation.id
                });
                if (titleResult.title) {
                  setCurrentConversation(prev => ({ ...prev, title: titleResult.title }));
                  await loadConversations(user.id);
                }
              } catch (titleError) {
                console.warn('[WARN] Failed to generate conversation title:', titleError);
              }
            }

            if (userMessageCount % 5 === 0) {
              await invokeFunction('summarizeConversation', {
                conversationId: currentConversation.id
              });
            }
          } catch (metaErr) {
            console.warn('[BOOKKEEPING] Title/summary error:', metaErr);
          }
        } else {
          console.warn('[PERSIST] Skipped ChatHistory.update — no currentConversation.id:', currentConversation?.id);
        }

        try {
          // Deduct 1 token and persist to database (skip for premium)
          if (isAuthenticated && user && !isPremium) {
            const newTokenBalance = Math.max(0, tokenBalance - 1);
            setTokenBalance(newTokenBalance);
            await fetch('/api/admin-users', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: user.id, token_balance: newTokenBalance }),
            });
          }

          // Save AI memories with deduplication and filtering
          if (isAuthenticated && user) {
            await extractAndSaveMemories(messageText, response.data?.message || '', user);
          }
        } catch (err) {
          console.error('[BOOKKEEPING] Non-fatal error:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      // Always clear briefStatus on error to dismiss the LoadingOverlay.
      // The overlay is a display-only component — it never times out on its own.
      // Context (familyBrief) is preserved in Consultant state for retry.
      const wasBriefConfirmed = briefStatus === 'confirmed';
      setBriefStatus(null);

      // Add error message to chat with context-aware retry guidance
      const errorMessage = {
        role: 'assistant',
        content: wasBriefConfirmed
          ? "The search took a bit longer than expected. Click **Try Again** below to retry — I still have all your details."
          : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
        ...(wasBriefConfirmed ? { retryAction: 'GUIDED_INTRO_RETRY' } : {}),
      };
      setMessages([...updatedMessages, errorMessage]);
    }
            finally {
      // CRT-S109-F15: Reset processing guard and process queued messages
      isProcessing = false;
      await processQueuedMessages();
           }
    
  };

  return { handleSendMessage };
};
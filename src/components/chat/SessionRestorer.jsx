// Component: SessionRestorer
// Purpose: Restore chat session from URL param for returning users
// Last Modified: 2026-03-01

import { STATES } from '@/lib/stateMachineConfig';
import { fetchSchools } from '@/lib/api/schools';
import { fetchConversations, fetchConversation } from '@/lib/api/conversations';
import { fetchSession } from '@/lib/api/sessions';
import { invokeFunction } from '@/lib/functions';
import { createClient } from '@/lib/supabase/client';

// ─── Phase 1e: Normalized table read helpers ────────────────────────

/**
 * Load conversation state from the normalized conversation_state table.
 * Returns null if not found (normalized tables are sole source of truth).
 */
async function loadConversationState(conversationId) {
  if (!conversationId) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('conversation_state')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    if (error) {
      console.log('[PHASE-1E] conversation_state query returned no row for:', conversationId, error.message);
      return null;
    }
    console.log('[PHASE-1E] conversation_state loaded for:', conversationId);
    return data;
  } catch (e) {
    console.warn('[PHASE-1E] loadConversationState exception:', e.message);
    return null;
  }
}

/**
 * Load current schools from the normalized conversation_schools table,
 * joined with the schools table to get full school objects.
 * Returns empty array if not found (normalized tables are sole source of truth).
 */
async function loadConversationSchools(conversationId) {
  if (!conversationId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('conversation_schools')
      .select('school_id, rank, schools(*)')
      .eq('conversation_id', conversationId)
      .eq('is_current_results', true)
      .order('rank', { ascending: true });
    if (error) {
      console.log('[PHASE-1E] conversation_schools query failed for:', conversationId, error.message);
      return [];
    }
    // Flatten: extract the joined school object from each row
    const schools = (data || [])
      .map(row => row.schools)
      .filter(Boolean);
    console.log('[PHASE-1E] conversation_schools loaded', schools.length, 'schools for:', conversationId);
    return schools;
  } catch (e) {
    console.warn('[PHASE-1E] loadConversationSchools exception:', e.message);
    return [];
  }
}

export async function restoreSessionFromParam(
  sessionIdParam,
  _unused,
  isAuthenticated,
  user,
  setSelectedConsultant,
  setRestoredSessionData,
  setMessages,
  setFamilyProfile,
  setSchools,
  setCurrentView,
  setOnboardingPhase,
  setCurrentConversation,
  setSessionRestored,
  setRestoringSession,
  _loadShortlist_removed,
  isRestoringSessionRef,
  sessionParamProcessedRef,
  setDebugInfo,
  setDeepDiveAnalysis,
  setSelectedSchool,
  setVisitPrepKit,
  setActionPlan,
  skipViewOverrideRef,
  setSchoolAnalyses
) {
  if (!sessionIdParam) return;
  // CRITICAL: Set flag FIRST to override isIntakePhase during restoration
  sessionParamProcessedRef.current = true;
  isRestoringSessionRef.current = true;
  if (skipViewOverrideRef) skipViewOverrideRef.current = true;
  setRestoringSession(true);
  try {
    // Fetch ChatSession
    console.log('[RESTORE] Attempting to fetch ChatSession with ID:', sessionIdParam);
    const chatSession = await fetchSession(sessionIdParam);
    console.log('[RESTORE] ChatSession fetched:', chatSession ? 'Success' : 'Not found');
    
    if (!chatSession) {
      console.error('[RESTORE] ChatSession not found with ID:', sessionIdParam);
      setSessionRestored(true);
      return;
    }

    // WC6: Store session data for returning user context
    setRestoredSessionData({
      sessionId: chatSession.id,
      profileName: chatSession.profile_name,
      consultantName: chatSession.consultant_selected,
      matchedSchoolsCount: chatSession.matched_schools ? JSON.parse(chatSession.matched_schools).length : 0,
      createdDate: chatSession.created_date,
      updatedDate: chatSession.updated_date
    });

    // CRITICAL: Restore consultant selection FIRST so chat panel can render correctly
    if (chatSession.consultant_selected) {
      setSelectedConsultant(chatSession.consultant_selected);
    } else {
      // Fallback: older sessions may lack consultant_selected — default to jackie
      // to prevent the consultant picker from showing on refresh
      console.log('[RESTORE] consultant_selected missing, defaulting to jackie');
      setSelectedConsultant('jackie');
    }

    // DIRECT SEARCH CALL - Match orchestrateConversation's pattern
    let restoredSchools = [];
    try {
      const locationArea = chatSession.location_area;
      const searchParams = {
        limit: 50,
        minGrade: chatSession.child_grade,
        maxGrade: chatSession.child_grade,
        maxTuition: chatSession.max_tuition
      };

      if (locationArea) {
        const locationAreaLower = locationArea.toLowerCase().trim();
        const regionAliases = ['gta', 'greater toronto area', 'lower mainland', 'metro vancouver', 'greater vancouver'];
        if (regionAliases.includes(locationAreaLower)) {
          searchParams.region = locationArea;
        } else {
          const cityToProvinceMap = {
            'toronto': 'Ontario', 'vancouver': 'British Columbia', 'calgary': 'Alberta',
            'edmonton': 'Alberta', 'montreal': 'Quebec', 'ottawa': 'Ontario',
            'winnipeg': 'Manitoba', 'halifax': 'Nova Scotia', 'victoria': 'British Columbia',
            'quebec city': 'Quebec', 'saskatoon': 'Saskatchewan', 'regina': 'Saskatchewan'
          };
          const locationParts = locationArea.split(',').map(s => s.trim());
          if (locationParts.length >= 2) {
            searchParams.city = locationParts[0];
            searchParams.provinceState = locationParts[1];
          } else if (locationParts.length === 1) {
            searchParams.city = locationParts[0];
            const inferredProvince = cityToProvinceMap[locationParts[0].toLowerCase()];
            if (inferredProvince) {
              searchParams.provinceState = inferredProvince;
            }
          }
        }
      }

      const response = await invokeFunction('searchSchools', searchParams);
      setDebugInfo('location=' + locationArea + ' | city=' + (searchParams.city || 'N/A') + ' grade=' + chatSession.child_grade + ' tuition=' + chatSession.max_tuition + ' | schools=' + (response?.data?.schools?.length || 0));
      restoredSchools = response?.data?.schools || [];
    } catch (err) {
      setDebugInfo('searchSchools ERROR: ' + err.message);
      console.error('RESTORE searchSchools error:', err);
    }

    // Fetch and restore ChatHistory messages and context
    let chatHistory = null;
    if (chatSession.chat_history_id) {
      try {
        chatHistory = await fetchConversation(chatSession.chat_history_id);
      } catch (err) {
        console.warn('[RESTORE] Failed to fetch conversation for chat_history_id:', chatSession.chat_history_id, err.message);
      }
      if (chatHistory?.messages) {
        setMessages(chatHistory.messages);
      }
    } else {
      console.log('[RESTORE] No chat_history_id on session — skipping conversation restore');
    }

    // Phase 1e: Load normalized conversation state (fallback to JSONB below)
    const convId = chatHistory?.id || chatSession.chat_history_id || null;
    const normalizedState = convId ? await loadConversationState(convId) : null;

    // BUG-RN-05 FIX + Bug 2: Collect ALL deep dive analyses from messages (not just the last)
    const restoredMessages = chatHistory?.messages || [];
    const allDeepDiveAnalyses = {};
    let lastDeepDiveSchoolId = null;
    let lastDeepDiveSchoolName = null;
    for (const msg of restoredMessages) {
      if (msg.role === 'assistant' && msg.deepDiveAnalysis?.schoolId) {
        allDeepDiveAnalyses[msg.deepDiveAnalysis.schoolId] = msg.deepDiveAnalysis;
      }
    }
    const deepDiveSchoolIds = Object.keys(allDeepDiveAnalyses);
    if (deepDiveSchoolIds.length > 0) {
      const lastId = deepDiveSchoolIds[deepDiveSchoolIds.length - 1];
      lastDeepDiveSchoolId = lastId;
      lastDeepDiveSchoolName = allDeepDiveAnalyses[lastId].schoolName;
      if (setDeepDiveAnalysis) setDeepDiveAnalysis(allDeepDiveAnalyses[lastId]);
      // Merge ALL analyses into schoolAnalyses state so every notepad renders
      if (setSchoolAnalyses) {
        setSchoolAnalyses(prev => ({ ...prev, ...allDeepDiveAnalyses }));
      }
    }

    // BUG-RN-05 FALLBACK: If messages don't contain deepDiveAnalysis, check SchoolAnalysis entity
    if (!lastDeepDiveSchoolId && isAuthenticated && user?.id) {
      try {
        // BUG-RN-PERSIST Fix E: Omit conversationId when falsy to avoid matching empty-string rows
        const restoreFilter = { user_id: user.id };
        if (chatHistory?.id) restoreFilter.conversation_id = chatHistory.id;
        const analysisParams = new URLSearchParams(restoreFilter);
        const analysisRes = await fetch(`/api/school-analyses?${analysisParams}`);
        const recentAnalyses = analysisRes.ok ? await analysisRes.json() : [];
        if (recentAnalyses?.length > 0) {
          // Bug 2: Merge ALL analyses into schoolAnalyses, set most recent as active
          const analysesMap = {};
          for (const analysis of recentAnalyses) {
            if (analysis.school_id) {
              const mapped = {
                schoolId: analysis.school_id,
                schoolName: analysis.school_name || 'School',
                fitScore: analysis.fit_score,
                fitLabel: analysis.fit_label,
                priorityMatches: analysis.priority_matches || [],
                aiInsight: analysis.ai_insight || analysis.insight || null,
                tradeOffs: analysis.trade_offs || analysis.tradeoffs || [],
                ...analysis
              };
              analysesMap[analysis.school_id] = mapped;
            }
          }
          if (setSchoolAnalyses && Object.keys(analysesMap).length > 0) {
            setSchoolAnalyses(prev => ({ ...prev, ...analysesMap }));
          }

          const sorted = recentAnalyses.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          const latest = sorted[0];
          lastDeepDiveSchoolId = latest.school_id;
          lastDeepDiveSchoolName = latest.school_name || 'School';
          console.log('[RESTORE] Fallback: found', recentAnalyses.length, 'SchoolAnalysis rows, active school:', lastDeepDiveSchoolId);
          if (setDeepDiveAnalysis) {
            const mappedAnalysis = analysesMap[latest.school_id] || latest;
            setDeepDiveAnalysis(mappedAnalysis);
            // WC-2: Inject analysis onto last assistant message so E39-S4a can find it
            const injectedMsgs = [...restoredMessages];
            for (let i = injectedMsgs.length - 1; i >= 0; i--) {
              if (injectedMsgs[i].role === 'assistant') {
                injectedMsgs[i] = { ...injectedMsgs[i], deepDiveAnalysis: mappedAnalysis };
                break;
              }
            }
            setMessages(injectedMsgs);
          }
        }
      } catch (e) {
        console.warn('[RESTORE] SchoolAnalysis fallback failed:', e.message);
      }
    }

    // Fetch and restore FamilyProfile
    let restoredProfile = null;
    if (chatSession.family_profile_id) {
      const fpRes = await fetch(`/api/family-profile?id=${chatSession.family_profile_id}`);
      restoredProfile = fpRes.ok ? await fpRes.json() : null;
      if (restoredProfile) {
        setFamilyProfile(restoredProfile);
      }
    } else {
      // PHASE-1FG: Normalized conversation_state is sole source of truth for family profile fields
      if (normalizedState) {
        console.log('[PHASE-1FG] Using conversation_state for family profile fields');
        restoredProfile = {
          child_name: normalizedState.child_name || chatSession.child_name,
          child_grade: normalizedState.child_grade || chatSession.child_grade,
          location_area: normalizedState.location_area || chatSession.location_area,
          max_tuition: normalizedState.max_tuition || chatSession.max_tuition,
          priorities: normalizedState.priorities || chatSession.priorities || [],
          learning_differences: normalizedState.learning_differences || chatSession.learning_differences || []
        };
      } else {
        // No normalized state — use ChatSession fields directly (no JSONB fallback)
        console.log('[PHASE-1FG] No conversation_state found, using ChatSession fields');
        restoredProfile = {
          child_name: chatSession.child_name,
          child_grade: chatSession.child_grade,
          location_area: chatSession.location_area,
          max_tuition: chatSession.max_tuition,
          priorities: chatSession.priorities || [],
          learning_differences: chatSession.learning_differences || []
        };
      }
      setFamilyProfile(restoredProfile);
    }

    // Set schools and conversation state
    console.log('[RESTORE] Setting state with', restoredSchools.length, 'schools');
    setSchools(restoredSchools);
    if (restoredSchools.length > 0) {
      setCurrentView('schools');
      setOnboardingPhase(STATES.RESULTS);
    }

    // PHASE-1FG: Normalized state is sole source of truth for resumeView/state
    const effectiveResumeView = normalizedState?.resume_view || normalizedState?.state || null;
    console.log('[PHASE-1FG] conversation_state resumeView/state:', effectiveResumeView);
    const hasDeepDiveRestore = !!lastDeepDiveSchoolId;
    if (lastDeepDiveSchoolId && setSelectedSchool) {
      console.log('[RESTORE] Found deep dive in messages for school:', lastDeepDiveSchoolId, lastDeepDiveSchoolName);
      const targetSchool = restoredSchools.find(s => s.id === lastDeepDiveSchoolId);
      if (targetSchool) {
        setSelectedSchool(targetSchool);
      } else {
        // School not in search results - fetch full record from entity
        try {
          const fullSchools = await fetchSchools({ ids: [lastDeepDiveSchoolId] });
          if (fullSchools && fullSchools.length > 0) {
            setSelectedSchool(fullSchools[0]);
          } else {
            setSelectedSchool({ id: lastDeepDiveSchoolId, name: lastDeepDiveSchoolName || 'School' });
          }
        } catch (e) {
          console.warn('[RESTORE] Failed to fetch full school record:', e.message);
          setSelectedSchool({ id: lastDeepDiveSchoolId, name: lastDeepDiveSchoolName || 'School' });
        }
      }
      setOnboardingPhase(STATES.DEEP_DIVE);
      setCurrentView('detail');
    }
    if (chatHistory) {
      const restoredJourneyId = normalizedState?.journey_id || chatHistory?.conversation_context?.journeyId || null;
      console.log('[RESTORE] journeyId surfaced:', restoredJourneyId);
      const restoredContext = {
        ...(chatHistory.conversation_context || {}),
        state: hasDeepDiveRestore ? STATES.DEEP_DIVE : (effectiveResumeView || (restoredSchools.length > 0 ? STATES.RESULTS : STATES.WELCOME)),
        schools: restoredSchools,
        ...(restoredJourneyId ? { journeyId: restoredJourneyId } : {})
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matched_schools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await fetchSchools({ ids: schoolIds });
        restoredContext.schools = fullSchools;
        setSchools(fullSchools);
      }
      const restoredConversation = {
        ...chatHistory,
        conversation_context: restoredContext
      };
      setCurrentConversation(restoredConversation);
    } else {
      const restoredJourneyIdAlt = normalizedState?.journey_id || null;
      console.log('[RESTORE] journeyId surfaced (no chatHistory):', restoredJourneyIdAlt);
      const restoredContext = {
        state: hasDeepDiveRestore ? STATES.DEEP_DIVE : (effectiveResumeView || (restoredSchools.length > 0 ? STATES.RESULTS : STATES.WELCOME)),
        schools: restoredSchools,
        ...(restoredJourneyIdAlt ? { journeyId: restoredJourneyIdAlt } : {})
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matched_schools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await fetchSchools({ ids: schoolIds });
        restoredContext.schools = fullSchools;
        setSchools(fullSchools);
      }
      setCurrentConversation({
        conversation_context: restoredContext
      });
    }



    // Add welcome-back message
    const childName = chatSession.child_name || 'your child';
    const welcomeMsg = {
      role: 'assistant',
      content: `Welcome back! I see we were exploring schools for ${childName}. Want to pick up where we left off or update anything?`,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, welcomeMsg]);

    setSessionRestored(true);
  } catch (error) {
    console.error('Failed to restore session:', error);
    setSessionRestored(true);
  } finally {
    isRestoringSessionRef.current = false;
    setRestoringSession(false);
  }
}

/**
 * Restore the user's most recently updated conversation when no sessionIdParam
 * is present (e.g. plain F5 / new tab). Sets currentConversation.id so that
 * useDataLoader can repopulate SchoolAnalysis → ResearchNotepad.
 */
export async function restoreMostRecentConversation(
  _unused,
  user,
  setMessages,
  setSelectedConsultant,
  setCurrentConversation,
  setFamilyProfile,
  setSchools,
  setCurrentView,
  setOnboardingPhase,
  setDeepDiveAnalysis,
  setSelectedSchool,
  isRestoringSessionRef,
  skipViewOverrideRef,
  setSchoolAnalyses
) {
  if (!user?.id) return;
  isRestoringSessionRef.current = true;
  if (skipViewOverrideRef) skipViewOverrideRef.current = true;

  try {
    // 1. Fetch all active conversations for this user, pick the most recent
    const convos = await fetchConversations();
    if (!convos || convos.length === 0) {
      console.log('[RESTORE-LATEST] No active conversations found');
      return;
    }
    const sorted = convos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const latest = sorted[0];
    console.log('[RESTORE-LATEST] Restoring most recent conversation:', latest.id);

    // 2. Restore messages
    if (latest.messages?.length > 0) {
      setMessages(latest.messages);
    }

    // Phase 1e: Load normalized conversation state + schools
    const normalizedState2 = await loadConversationState(latest.id);
    const normalizedSchools = await loadConversationSchools(latest.id);

    // PHASE-1FG: Normalized state is sole source of truth for consultant
    const ctx = latest.conversation_context || {};
    const restoredConsultant = normalizedState2?.consultant || null;
    if (restoredConsultant) {
      console.log('[PHASE-1FG] Using conversation_state for consultant:', restoredConsultant);
      setSelectedConsultant(restoredConsultant);
    } else if (latest.messages?.length > 0) {
      // Fallback: conversation has messages but consultant not in normalized state —
      // default to jackie to prevent consultant picker from showing on refresh
      console.log('[RESTORE-LATEST] consultant missing from conversation_state, defaulting to jackie');
      setSelectedConsultant('jackie');
    }

    // 4. Bug 2: Collect ALL deep dive analyses from messages, set most recent as active
    let lastDeepDiveSchoolId = null;
    const msgs = latest.messages || [];
    const allDeepDiveAnalyses = {};
    for (const msg of msgs) {
      if (msg.role === 'assistant' && msg.deepDiveAnalysis?.schoolId) {
        allDeepDiveAnalyses[msg.deepDiveAnalysis.schoolId] = msg.deepDiveAnalysis;
      }
    }
    const deepDiveSchoolIds = Object.keys(allDeepDiveAnalyses);
    if (deepDiveSchoolIds.length > 0) {
      const lastId = deepDiveSchoolIds[deepDiveSchoolIds.length - 1];
      lastDeepDiveSchoolId = lastId;
      if (setDeepDiveAnalysis) setDeepDiveAnalysis(allDeepDiveAnalyses[lastId]);
      if (setSchoolAnalyses) {
        setSchoolAnalyses(prev => ({ ...prev, ...allDeepDiveAnalyses }));
      }
    }

    // 4b. Fallback: check SchoolAnalysis entity if messages lack deepDiveAnalysis
    if (!lastDeepDiveSchoolId && user.id) {
      try {
        const analysisParams = new URLSearchParams({ user_id: user.id });
        if (latest.id) analysisParams.set('conversation_id', latest.id);
        const analysisRes = await fetch(`/api/school-analyses?${analysisParams}`);
        const recentAnalyses = analysisRes.ok ? await analysisRes.json() : [];
        if (recentAnalyses?.length > 0) {
          // Bug 2: Merge ALL analyses into schoolAnalyses, set most recent as active
          const analysesMap = {};
          for (const analysis of recentAnalyses) {
            if (analysis.school_id) {
              const mapped = {
                schoolId: analysis.school_id,
                schoolName: analysis.school_name || 'School',
                fitScore: analysis.fit_score,
                fitLabel: analysis.fit_label,
                priorityMatches: analysis.priority_matches || [],
                aiInsight: analysis.ai_insight || analysis.insight || null,
                tradeOffs: analysis.trade_offs || analysis.tradeoffs || [],
                ...analysis
              };
              analysesMap[analysis.school_id] = mapped;
            }
          }
          if (setSchoolAnalyses && Object.keys(analysesMap).length > 0) {
            setSchoolAnalyses(prev => ({ ...prev, ...analysesMap }));
          }

          const sortedAnalyses = recentAnalyses.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          const la = sortedAnalyses[0];
          lastDeepDiveSchoolId = la.school_id;
          console.log('[RESTORE-LATEST] Fallback: found', recentAnalyses.length, 'SchoolAnalysis rows, active school:', la.school_id);
          if (setDeepDiveAnalysis) {
            const mappedAnalysis = analysesMap[la.school_id] || la;
            setDeepDiveAnalysis(mappedAnalysis);
            // Inject onto last assistant message so downstream components find it
            const injectedMsgs = [...msgs];
            for (let j = injectedMsgs.length - 1; j >= 0; j--) {
              if (injectedMsgs[j].role === 'assistant') {
                injectedMsgs[j] = { ...injectedMsgs[j], deepDiveAnalysis: mappedAnalysis };
                break;
              }
            }
            setMessages(injectedMsgs);
          }
        }
      } catch (e) {
        console.warn('[RESTORE-LATEST] SchoolAnalysis fallback failed:', e.message);
      }
    }

    // PHASE-1FG: Normalized conversation_schools is sole source of truth,
    // with fallback to matched_schools from the ChatSession/conversation JSONB
    let restoredSchools = normalizedSchools;
    if (restoredSchools.length === 0) {
      // Fallback: hydrate from matched_schools stored in conversation context
      let schoolIds = ctx.matched_schools || latest.matched_schools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        try {
          const fullSchools = await fetchSchools({ ids: schoolIds });
          if (fullSchools?.length > 0) restoredSchools = fullSchools;
        } catch (e) {
          console.warn('[RESTORE-LATEST] matched_schools fallback failed:', e.message);
        }
      }
      console.log('[RESTORE-LATEST] conversation_schools empty, matched_schools fallback:', restoredSchools.length, 'schools');
    } else {
      console.log('[PHASE-1FG] conversation_schools loaded:', restoredSchools.length, 'schools');
    }
    if (restoredSchools.length > 0) setSchools(restoredSchools);

    // PHASE-1FG: Normalized conversation_state is sole source of truth for family profile
    if (normalizedState2 && (normalizedState2.child_name || normalizedState2.child_grade || normalizedState2.location_area)) {
      console.log('[PHASE-1FG] Using conversation_state for family profile fields');
      const fp = {
        child_name: normalizedState2.child_name,
        child_grade: normalizedState2.child_grade,
        location_area: normalizedState2.location_area,
        max_tuition: normalizedState2.max_tuition,
        priorities: normalizedState2.priorities || [],
        learning_differences: normalizedState2.learning_differences || [],
      };
      // FIX-BRIEF-PERSIST: Relax guard — the outer check already guarantees at
      // least child_name or child_grade is present, so always set the profile.
      setFamilyProfile(fp);
    }

    // PHASE-1FG: Normalized state is sole source of truth
    const hasDeepDive = !!lastDeepDiveSchoolId;
    // FIX-ROUTING: Only default to RESULTS if there are actually restored schools.
    // New/empty conversations without normalized state should stay at WELCOME.
    const rawEffectiveState = normalizedState2?.resume_view || normalizedState2?.state || null;
    const effectiveState = rawEffectiveState || (restoredSchools.length > 0 ? STATES.RESULTS : (ctx.state || STATES.WELCOME));
    console.log('[PHASE-1FG] conversation_state state:', effectiveState);
    const restoredState = hasDeepDive ? STATES.DEEP_DIVE : effectiveState;

    if (hasDeepDive && setSelectedSchool) {
      const target = restoredSchools.find(s => s.id === lastDeepDiveSchoolId);
      if (target) {
        setSelectedSchool(target);
      } else {
        try {
          const fullSchools = await fetchSchools({ ids: [lastDeepDiveSchoolId] });
          if (fullSchools?.length > 0) setSelectedSchool(fullSchools[0]);
        } catch (_) { /* best effort */ }
      }
      setCurrentView('detail');
    } else if (restoredSchools.length > 0) {
      setCurrentView('schools');
    }
    setOnboardingPhase(restoredState);

    // 8. Set currentConversation — this is the key: useDataLoader watches currentConversation.id
    const restoredJourneyId = normalizedState2?.journey_id || ctx.journeyId || null;
    console.log('[RESTORE] journeyId surfaced:', restoredJourneyId);
    setCurrentConversation({
      ...latest,
      conversation_context: {
        ...ctx,
        state: restoredState,
        schools: restoredSchools,
        ...(restoredJourneyId ? { journeyId: restoredJourneyId } : {})
      }
    });

    console.log('[RESTORE-LATEST] Restore complete — conversation:', latest.id, 'state:', restoredState);
  } catch (error) {
    console.error('[RESTORE-LATEST] Failed to restore most recent conversation:', error);
  } finally {
    isRestoringSessionRef.current = false;
    if (skipViewOverrideRef) skipViewOverrideRef.current = false;
  }
}

export const restoreGuestSession = (isAuthenticated, user, currentConversation, setMessages, setSelectedConsultant, setCurrentConversation, _unused) => {
  // Phase 5 cleanup: Guest conversation data is no longer stored in localStorage.
  // The login gate is a non-blocking overlay — React state (messages, consultant,
  // conversation context) remains intact while the user signs in, so no bridging needed.
};
// Component: SessionRestorer
// Purpose: Restore chat session from URL param for returning users
// Last Modified: 2026-03-01

import { STATES } from '@/lib/stateMachineConfig';
import { STATES as STATES_FOR_GUEST } from '@/lib/stateMachineConfig';
import { ChatSession, ChatHistory, SchoolAnalysis, FamilyProfile, School } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';

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
  loadShortlist,
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
    const chatSession = await ChatSession.get(sessionIdParam);
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
      chatHistory = await ChatHistory.get(chatSession.chat_history_id);
      if (chatHistory?.messages) {
        setMessages(chatHistory.messages);
      }
    }

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
        const recentAnalyses = await SchoolAnalysis.filter(restoreFilter);
        if (recentAnalyses?.length > 0) {
          // Bug 2: Merge ALL analyses into schoolAnalyses, set most recent as active
          const analysesMap = {};
          for (const analysis of recentAnalyses) {
            if (analysis.school_id) {
              const mapped = {
                schoolId: analysis.school_id,
                schoolName: analysis.schoolName || 'School',
                fitScore: analysis.fitScore,
                fitLabel: analysis.fitLabel,
                priorityMatches: analysis.priorityMatches || [],
                aiInsight: analysis.aiInsight || analysis.insight || null,
                tradeOffs: analysis.tradeOffs || analysis.tradeoffs || [],
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
          lastDeepDiveSchoolName = latest.schoolName || 'School';
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
      restoredProfile = await FamilyProfile.get(chatSession.family_profile_id);
      if (restoredProfile) {
        setFamilyProfile(restoredProfile);
      }
    } else {
      // BUG-LOCATION-EXTRACT-S97 FIX: Prefer extractedEntities.locationArea from ChatHistory context
      // over ChatSession.locationArea which may contain stale/invalid values (e.g. 'Grade')
      const restoredLocationArea = chatHistory?.conversation_context?.extractedEntities?.locationArea || chatSession.location_area;

      restoredProfile = {
        childName: chatSession.child_name,
        childGrade: chatSession.child_grade,
        locationArea: restoredLocationArea,
        maxTuition: chatSession.max_tuition,
        priorities: chatSession.priorities || [],
        learningDifferences: chatSession.learning_differences || []
      };
      setFamilyProfile(restoredProfile);
    }

    // Set schools and conversation state
    console.log('[RESTORE] Setting RESULTS state with', restoredSchools.length, 'schools');
    setSchools(restoredSchools);
    setCurrentView('schools');
    setOnboardingPhase(STATES.RESULTS);

    // Restore deep dive state from message scan (BUG-RN-05)
    const conversationContext = chatHistory?.conversation_context || {};
    const hasDeepDiveRestore = !!lastDeepDiveSchoolId;
    if (lastDeepDiveSchoolId && setSelectedSchool) {
      console.log('[RESTORE] Found deep dive in messages for school:', lastDeepDiveSchoolId, lastDeepDiveSchoolName);
      const targetSchool = restoredSchools.find(s => s.id === lastDeepDiveSchoolId);
      if (targetSchool) {
        setSelectedSchool(targetSchool);
      } else {
        // School not in search results - fetch full record from entity
        try {
          const fullSchools = await School.filter({ id: lastDeepDiveSchoolId });
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
      const restoredContext = {
        ...(chatHistory.conversation_context || {}),
        state: hasDeepDiveRestore ? STATES.DEEP_DIVE : (conversationContext.resumeView || conversationContext.state || STATES.RESULTS),
        schools: restoredSchools
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matched_schools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await School.filter({ id: { $in: schoolIds } });
        restoredContext.schools = fullSchools;
        setSchools(fullSchools);
      }
      const restoredConversation = {
        ...chatHistory,
        conversationContext: restoredContext
      };
      setCurrentConversation(restoredConversation);
    } else {
      const restoredContext = {
        state: hasDeepDiveRestore ? STATES.DEEP_DIVE : (conversationContext.resumeView || conversationContext.state || STATES.RESULTS),
        schools: restoredSchools
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matched_schools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await School.filter({ id: { $in: schoolIds } });
        restoredContext.schools = fullSchools;
        setSchools(fullSchools);
      }
      setCurrentConversation({
        conversationContext: restoredContext
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
    const convos = await ChatHistory.filter({ user_id: user.id, is_active: true });
    if (!convos || convos.length === 0) {
      console.log('[RESTORE-LATEST] No active conversations found');
      return;
    }
    const sorted = convos.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
    const latest = sorted[0];
    console.log('[RESTORE-LATEST] Restoring most recent conversation:', latest.id);

    // 2. Restore messages
    if (latest.messages?.length > 0) {
      setMessages(latest.messages);
    }

    // 3. Restore consultant from conversationContext
    const ctx = latest.conversation_context || {};
    if (ctx.consultant) {
      setSelectedConsultant(ctx.consultant);
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
        const latestFilter = { user_id: user.id };
        if (latest.id) latestFilter.conversation_id = latest.id;
        const recentAnalyses = await SchoolAnalysis.filter(latestFilter);
        if (recentAnalyses?.length > 0) {
          // Bug 2: Merge ALL analyses into schoolAnalyses, set most recent as active
          const analysesMap = {};
          for (const analysis of recentAnalyses) {
            if (analysis.school_id) {
              const mapped = {
                schoolId: analysis.school_id,
                schoolName: analysis.schoolName || 'School',
                fitScore: analysis.fitScore,
                fitLabel: analysis.fitLabel,
                priorityMatches: analysis.priorityMatches || [],
                aiInsight: analysis.aiInsight || analysis.insight || null,
                tradeOffs: analysis.tradeOffs || analysis.tradeoffs || [],
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

    // 5. Restore schools from conversationContext
    let restoredSchools = ctx.schools || [];
    if (typeof restoredSchools === 'string') {
      try { restoredSchools = JSON.parse(restoredSchools); } catch (_) { restoredSchools = []; }
    }
    // If stored as IDs, fetch full records
    if (Array.isArray(restoredSchools) && restoredSchools.length > 0 && typeof restoredSchools[0] === 'string') {
      try {
        restoredSchools = await School.filter({ id: { $in: restoredSchools } });
      } catch (_) { /* keep as-is */ }
    }
    if (restoredSchools.length > 0) setSchools(restoredSchools);

    // 6. Restore family profile from context if available
    if (ctx.extractedEntities) {
      const fp = {
        childName: ctx.extractedEntities.childName,
        childGrade: ctx.extractedEntities.childGrade,
        locationArea: ctx.extractedEntities.locationArea,
        maxTuition: ctx.extractedEntities.maxTuition,
        priorities: ctx.extractedEntities.priorities || [],
        learningDifferences: ctx.extractedEntities.learningDifferences || [],
      };
      // Only set if there's at least one meaningful value
      if (Object.values(fp).some(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))) {
        setFamilyProfile(fp);
      }
    }

    // 7. Determine correct state and set currentConversation (triggers useDataLoader)
    const hasDeepDive = !!lastDeepDiveSchoolId;
    const restoredState = hasDeepDive ? STATES.DEEP_DIVE : (ctx.state || ctx.resumeView || STATES.RESULTS);

    if (hasDeepDive && setSelectedSchool) {
      const target = restoredSchools.find(s => s.id === lastDeepDiveSchoolId);
      if (target) {
        setSelectedSchool(target);
      } else {
        try {
          const fullSchools = await School.filter({ id: lastDeepDiveSchoolId });
          if (fullSchools?.length > 0) setSelectedSchool(fullSchools[0]);
        } catch (_) { /* best effort */ }
      }
      setCurrentView('detail');
    } else if (restoredSchools.length > 0) {
      setCurrentView('schools');
    }
    setOnboardingPhase(restoredState);

    // 8. Set currentConversation — this is the key: useDataLoader watches currentConversation.id
    setCurrentConversation({
      ...latest,
      conversationContext: {
        ...ctx,
        state: restoredState,
        schools: restoredSchools,
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
  const guestData = localStorage.getItem('guestConversationData');
  // FIX-RESULTS-VIEW: Removed `isAuthenticated` guard — this function restores data
  // saved WHILE the user was a guest. It must work when called after the user signs in
  // through the login gate modal and returns to the page.
  if (!guestData) return;

  try {
    const {
      messages,
      consultant,
      conversationContext,
      familyProfile,
      briefStatus,
      extractedEntitiesData,
      sessionId
    } = JSON.parse(guestData);

    // Restore messages
    setMessages(messages || []);

    // Restore consultant if not already selected
    if (consultant) {
      setSelectedConsultant(consultant);
    }

    // Restore conversation context
    if (conversationContext) {
      setCurrentConversation(prev => ({
        ...prev,
        conversationContext: {
          ...conversationContext,
          state: conversationContext.state || STATES_FOR_GUEST.WELCOME
        }
      }));
    }

    // Clear localStorage after restore
    localStorage.removeItem('guestConversationData');
  } catch (error) {
    console.error('Failed to restore guest session:', error);
  }
};
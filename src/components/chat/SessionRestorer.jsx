// Component: SessionRestorer
// Purpose: Restore chat session from URL param for returning users
// Last Modified: 2026-03-01

import { STATES } from '@/pages/stateMachineConfig';
import { STATES as STATES_FOR_GUEST } from '@/pages/stateMachineConfig';

export async function restoreSessionFromParam(
  sessionIdParam,
  base44,
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
  skipViewOverrideRef
) {
  if (!sessionIdParam) return;
  window.__RESTORE_DEBUG = [];
  // CRITICAL: Set flag FIRST to override isIntakePhase during restoration
  sessionParamProcessedRef.current = true;
  isRestoringSessionRef.current = true;
  if (skipViewOverrideRef) skipViewOverrideRef.current = true;
  console.log('[RESTORE-DEBUG] Starting restore. skipViewOverride set to true');
  window.__RESTORE_DEBUG.push('[RESTORE-DEBUG] Starting restore. skipViewOverride set to true');
  setRestoringSession(true);
  try {
    // Fetch ChatSession
    console.log('[RESTORE] Attempting to fetch ChatSession with ID:', sessionIdParam);
    const chatSession = await base44.entities.ChatSession.get(sessionIdParam);
    console.log('[RESTORE] ChatSession fetched:', chatSession ? 'Success' : 'Not found');
    
    if (!chatSession) {
      console.error('[RESTORE] ChatSession not found with ID:', sessionIdParam);
      setSessionRestored(true);
      return;
    }

    // WC6: Store session data for returning user context
    setRestoredSessionData({
      sessionId: chatSession.id,
      profileName: chatSession.profileName,
      consultantName: chatSession.consultantSelected,
      matchedSchoolsCount: chatSession.matchedSchools ? JSON.parse(chatSession.matchedSchools).length : 0,
      createdDate: chatSession.created_date,
      updatedDate: chatSession.updated_date
    });

    // CRITICAL: Restore consultant selection FIRST so chat panel can render correctly
    if (chatSession.consultantSelected) {
      setSelectedConsultant(chatSession.consultantSelected);
    }

    // DIRECT SEARCH CALL - Match orchestrateConversation's pattern
    let restoredSchools = [];
    try {
      const locationArea = chatSession.locationArea;
      const searchParams = {
        limit: 50,
        minGrade: chatSession.childGrade,
        maxGrade: chatSession.childGrade,
        maxTuition: chatSession.maxTuition
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

      const response = await base44.functions.invoke('searchSchools', searchParams);
      setDebugInfo('location=' + locationArea + ' | city=' + (searchParams.city || 'N/A') + ' grade=' + chatSession.childGrade + ' tuition=' + chatSession.maxTuition + ' | schools=' + (response?.data?.schools?.length || 0));
      restoredSchools = response?.data?.schools || [];
    } catch (err) {
      setDebugInfo('searchSchools ERROR: ' + err.message);
      console.error('RESTORE searchSchools error:', err);
    }

    // Fetch and restore ChatHistory messages and context
    let chatHistory = null;
    if (chatSession.chatHistoryId) {
      chatHistory = await base44.entities.ChatHistory.get(chatSession.chatHistoryId);
      if (chatHistory?.messages) {
        setMessages(chatHistory.messages);
      }
    }

    // BUG-RN-05 FIX: Scan restored messages for last deep-dived school
    const restoredMessages = chatHistory?.messages || [];
    let lastDeepDiveSchoolId = null;
    let lastDeepDiveSchoolName = null;
    for (let i = restoredMessages.length - 1; i >= 0; i--) {
      const msg = restoredMessages[i];
      if (msg.role === 'assistant' && msg.deepDiveAnalysis?.schoolId) {
        lastDeepDiveSchoolId = msg.deepDiveAnalysis.schoolId;
        lastDeepDiveSchoolName = msg.deepDiveAnalysis.schoolName;
        break;
      }
    }

    // Fetch and restore FamilyProfile
    let restoredProfile = null;
    if (chatSession.familyProfileId) {
      restoredProfile = await base44.entities.FamilyProfile.get(chatSession.familyProfileId);
      if (restoredProfile) {
        setFamilyProfile(restoredProfile);
      }
    } else {
      // BUG-LOCATION-EXTRACT-S97 FIX: Prefer extractedEntities.locationArea from ChatHistory context
      // over ChatSession.locationArea which may contain stale/invalid values (e.g. 'Grade')
      const restoredLocationArea = chatHistory?.conversationContext?.extractedEntities?.locationArea || chatSession.locationArea;

      restoredProfile = {
        childName: chatSession.childName,
        childGrade: chatSession.childGrade,
        locationArea: restoredLocationArea,
        maxTuition: chatSession.maxTuition,
        priorities: chatSession.priorities || [],
        learningDifferences: chatSession.learningDifferences || []
      };
      setFamilyProfile(restoredProfile);
    }

    // Set schools and conversation state
    console.log('[RESTORE] Setting RESULTS state with', restoredSchools.length, 'schools');
    setSchools(restoredSchools);
    setCurrentView('schools');
    setOnboardingPhase(STATES.RESULTS);

    // Restore deep dive state from message scan (BUG-RN-05)
    const conversationContext = chatHistory?.conversationContext || {};
    if (lastDeepDiveSchoolId && setSelectedSchool) {
      console.log('[RESTORE] Found deep dive in messages for school:', lastDeepDiveSchoolId, lastDeepDiveSchoolName);
      const targetSchool = restoredSchools.find(s => s.id === lastDeepDiveSchoolId);
      if (targetSchool) {
        setSelectedSchool(targetSchool);
      } else {
        // School not in search results - create minimal object for hydration
        setSelectedSchool({ id: lastDeepDiveSchoolId, name: lastDeepDiveSchoolName || 'School' });
      }
      setOnboardingPhase(STATES.DEEP_DIVE);
      setCurrentView('detail');
    }
    if (chatHistory) {
      const restoredContext = {
        ...(chatHistory.conversationContext || {}),
        state: conversationContext.resumeView || conversationContext.state || STATES.RESULTS,
        schools: restoredSchools
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matchedSchools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await base44.entities.School.filter({ id: { $in: schoolIds } });
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
        state: conversationContext.resumeView || conversationContext.state || STATES.RESULTS,
        schools: restoredSchools
      };
      // S97-WC3: Hydrate schools from matchedSchools on reload (parse JSON string and fetch full records)
      let schoolIds = chatSession?.matchedSchools;
      if (typeof schoolIds === 'string') {
        try { schoolIds = JSON.parse(schoolIds); } catch (_) { schoolIds = []; }
      }
      if (Array.isArray(schoolIds) && schoolIds.length > 0) {
        const fullSchools = await base44.entities.School.filter({ id: { $in: schoolIds } });
        restoredContext.schools = fullSchools;
        setSchools(fullSchools);
      }
      setCurrentConversation({
        conversationContext: restoredContext
      });
    }



    // Add welcome-back message
    const childName = chatSession.childName || 'your child';
    const welcomeMsg = {
      role: 'assistant',
      content: `Welcome back! I see we were exploring schools for ${childName}. Want to pick up where we left off or update anything?`,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, welcomeMsg]);

    console.log('[RESTORE-DEBUG] About to clear skipViewOverrideRef via setTimeout');
    window.__RESTORE_DEBUG.push('[RESTORE-DEBUG] About to clear skipViewOverrideRef via setTimeout');
    window.__RESTORE_DEBUG.push('RESTORE COMPLETE');
    try { const d = document.createElement('div'); d.id = 'restore-debug'; d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;z-index:99999;padding:10px;font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap;'; d.textContent = window.__RESTORE_DEBUG.join('\n'); document.body.appendChild(d); } catch(e) {}
    if (skipViewOverrideRef) setTimeout(() => { skipViewOverrideRef.current = false; }, 0);
    setSessionRestored(true);
  } catch (error) {
    console.error('Failed to restore session:', error);
    if (skipViewOverrideRef) setTimeout(() => { skipViewOverrideRef.current = false; }, 0);
    setSessionRestored(true);
  } finally {
    isRestoringSessionRef.current = false;
    setRestoringSession(false);
  }
}

export const restoreGuestSession = (isAuthenticated, user, currentConversation, setMessages, setSelectedConsultant, setCurrentConversation, base44) => {
  const guestData = localStorage.getItem('guestConversationData');
  if (!guestData || isAuthenticated) return;

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
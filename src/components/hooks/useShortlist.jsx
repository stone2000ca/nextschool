import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getShortlistNudge } from '@/components/utils/shortlistNudges';
import { STATES } from '@/lib/stateMachineConfig';

export function useShortlist({
  user, setUser, isAuthenticated, schools, currentState,
  selectedConsultant, familyProfile, setMessages, trackEvent, setShowLoginGate,
  onConfirmDeepDive,
  currentConversation, activeJourney, extraSchools,
}) {
  const [shortlistData, setShortlistData] = useState([]);
  const [removedSchoolIds, setRemovedSchoolIds] = useState([]);
  const [expandedCardCount, setExpandedCardCount] = useState(0);
  const [autoExpandSchoolId, setAutoExpandSchoolId] = useState(null);
  const [pendingDeepDiveSchoolIds, setPendingDeepDiveSchoolIds] = useState(new Set());
  const hasAutoPopulatedShortlist = useRef(false);

  const loadShortlist = async (journeyId) => {
    const jid = journeyId || activeJourney?.journeyId || currentConversation?.conversation_context?.journeyId;
    if (!jid) return;
    try {
      const res = await fetch(`/api/shortlist?journey_id=${encodeURIComponent(jid)}`);
      if (!res.ok) {
        console.error('Failed to load shortlist:', res.status);
        return;
      }
      const { schools: loadedSchools } = await res.json();
      if (!loadedSchools || loadedSchools.length === 0) return;
      setShortlistData(loadedSchools);
    } catch (error) {
      console.error('Failed to load shortlist:', error);
    }
  };

  const injectShortlistNudge = (nudgeText) => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: nudgeText,
      timestamp: new Date().toISOString(),
      isNudge: true,
    }]);
  };

  const handleToggleShortlist = async (schoolId, options = {}) => {
    const { silent = false, school: preloadedSchool = null } = options;
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    if (!user) return;

    try {
      let school = preloadedSchool || schools.find(s => s.id === schoolId) || shortlistData.find(s => s.id === schoolId) || extraSchools?.find(s => s.id === schoolId);
      const isRemoving = shortlistData.some(s => s.id === schoolId);

      if (!school && !isRemoving) {
        // Fetch school data from local sources failed; the server will handle it
        // but we need it for client-side nudge display
        try {
          const res = await fetch(`/api/shortlist?journey_id=${encodeURIComponent('_lookup_')}&school_id=${encodeURIComponent(schoolId)}`);
          // Fallback: school may not be available for nudge, that's okay
        } catch (e) {
          console.error('[SHORTLIST] Failed to fetch school for toggle:', e.message);
        }
      }

      if (isRemoving) {
        // Optimistic UI update
        setShortlistData(prev => prev.filter(s => s.id !== schoolId));
        setRemovedSchoolIds(prev => [...prev, schoolId]);

        // Server-side removal (ChatShortlist + SchoolJourney + ChatSession)
        if (activeJourney?.journeyId) {
          fetch(`/api/shortlist/${encodeURIComponent(activeJourney.journeyId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              school_id: schoolId,
              conversation_id: currentConversation?.id || null,
              current_count: shortlistData.length,
            }),
          }).catch(e => console.error('[SHORTLIST] Remove failed:', e.message));
        }
      } else {
        // Optimistic UI update
        trackEvent('shortlisted', { metadata: { schoolName: school?.name } });
        if (school) setShortlistData(prev => [...prev, school]);

        // Server-side addition (ChatShortlist + SchoolJourney + FamilyJourney phase + ChatSession count)
        if (activeJourney?.journeyId) {
          fetch('/api/shortlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              journey_id: activeJourney.journeyId,
              school_id: schoolId,
              school_name: school?.name || '',
              conversation_id: currentConversation?.id || null,
              current_phase: activeJourney.currentPhase || null,
              phase_history: Array.isArray(activeJourney.phaseHistory) ? activeJourney.phaseHistory : [],
            }),
          }).catch(e => console.error('[SHORTLIST] Add failed:', e.message));
        }
      }

      // T-SL-004: Inject nudge (only in RESULTS state, only when not silent)
      if (!silent && currentState === STATES.RESULTS) {
        const updatedCount = isRemoving ? shortlistData.length - 1 : shortlistData.length + 1;
        const nudge = getShortlistNudge({
          isRemoving,
          newCount: updatedCount,
          isJackie: selectedConsultant === 'Jackie',
          school,
          familyProfile,
          shortlistData: isRemoving ? shortlistData.filter(s => s.id !== schoolId) : [...shortlistData, school].filter(Boolean),
          schools,
        });
        if (nudge) injectShortlistNudge(nudge);
      }
    } catch (error) {
      console.error('Failed to toggle shortlist:', error);
    }
  };

  // E29-012: Hydrate shortlistData from ChatShortlist on activeJourney load
  // Falls back to conversation_context.journeyId when activeJourney is null
  const effectiveJourneyId = activeJourney?.journeyId || currentConversation?.conversation_context?.journeyId;
  useEffect(() => {
    if (!effectiveJourneyId) { setShortlistData([]); return; }
    loadShortlist(effectiveJourneyId);
  }, [effectiveJourneyId]);

  // E30-006
  const handleDossierExpandChange = (isExpanding) =>
    setExpandedCardCount(prev => isExpanding ? prev + 1 : Math.max(0, prev - 1));

  // E30-008
  const handleDeepDiveFromDossier = (school) => {
    setPendingDeepDiveSchoolIds(prev => new Set([...prev, school.id]));
    onConfirmDeepDive?.(school);
  };

  return {
    shortlistData, setShortlistData,
    removedSchoolIds, setRemovedSchoolIds,
    expandedCardCount, setExpandedCardCount,
    autoExpandSchoolId, setAutoExpandSchoolId,
    pendingDeepDiveSchoolIds, setPendingDeepDiveSchoolIds,
    hasAutoPopulatedShortlist,
    loadShortlist,
    handleToggleShortlist,
    injectShortlistNudge,
    handleDossierExpandChange,
    handleDeepDiveFromDossier,
  };
}

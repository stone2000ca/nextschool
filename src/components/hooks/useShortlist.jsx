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
  const loadedForConversationRef = useRef(null);
  const fetchVersionRef = useRef(0); // FIX-SL-BLEED: fetch versioning to discard stale responses

  const loadShortlist = async () => {
    // FIX-SL-BLEED-v2: Always use conversation_id and let the API derive journey_id
    // server-side. This eliminates dependency on activeJourney (which loads async)
    // and prevents stale journeyId from conversation_context causing cross-chat bleed.
    const conversationId = currentConversation?.id;
    if (!conversationId) return;

    // FIX-SL-ISOLATE: If switching to a different conversation, clear shortlist first
    // to prevent stale optimistic state from the previous conversation bleeding through
    const isSwitching = loadedForConversationRef.current && loadedForConversationRef.current !== conversationId;
    if (isSwitching) {
      setShortlistData([]);
    }
    loadedForConversationRef.current = conversationId;

    // FIX-SL-BLEED: Increment version so we can discard stale responses
    const thisVersion = ++fetchVersionRef.current;

    try {
      const res = await fetch(`/api/shortlist?conversation_id=${encodeURIComponent(conversationId)}`);
      if (!res.ok) {
        // 400 is expected for new chats that don't have a journey yet
        if (res.status !== 400) console.error('Failed to load shortlist:', res.status);
        return;
      }
      const { schools: loadedSchools } = await res.json();

      // FIX-SL-BLEED: Discard result if a newer loadShortlist call has started
      if (thisVersion !== fetchVersionRef.current) return;

      // FIX-SL-PERSIST: Merge server data with any optimistic state instead of replacing.
      // This prevents the race where loadShortlist fires (via useEffect on effectiveJourneyId)
      // before fire-and-forget server writes have completed, wiping optimistic additions.
      setShortlistData(prev => {
        if (!loadedSchools || loadedSchools.length === 0) {
          // FIX-SL-BLEED: If we just switched conversations, return empty
          // instead of preserving prev (which belongs to the old conversation)
          if (isSwitching) return [];
          // Server returned empty — keep optimistic state intact (same conversation)
          return prev;
        }
        // Merge: start with server data, then add any optimistic items not yet on server
        const serverIds = new Set(loadedSchools.map(s => s.id));
        const optimisticOnly = prev.filter(s => !serverIds.has(s.id));
        return [...loadedSchools, ...optimisticOnly];
      });
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

    const conversationId = currentConversation?.id;
    // journey_id is optional — used for side effects (SchoolJourney, phase advancement) only
    const journeyId = activeJourney?.journeyId || null;

    try {
      let school = preloadedSchool || schools.find(s => s.id === schoolId) || shortlistData.find(s => s.id === schoolId) || extraSchools?.find(s => s.id === schoolId);
      const isRemoving = shortlistData.some(s => s.id === schoolId);

      if (isRemoving) {
        // Optimistic UI update
        setShortlistData(prev => prev.filter(s => s.id !== schoolId));
        setRemovedSchoolIds(prev => [...prev, schoolId]);

        // Server-side removal scoped to conversation
        if (conversationId) {
          try {
            const res = await fetch(`/api/shortlist/${encodeURIComponent(conversationId)}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                school_id: schoolId,
                journey_id: journeyId,
              }),
            });
            if (!res.ok) {
              console.error('[SHORTLIST] Remove failed:', res.status);
              toast.error('Failed to remove school from shortlist');
            }
          } catch (e) {
            console.error('[SHORTLIST] Remove failed:', e.message);
            toast.error('Failed to remove school from shortlist');
          }
        } else {
          console.warn('[SHORTLIST] No conversationId available — remove not persisted');
        }
      } else {
        // Optimistic UI update
        trackEvent('shortlisted', { metadata: { schoolName: school?.name } });
        if (school) setShortlistData(prev => [...prev, school]);

        // Server-side addition scoped to conversation
        if (conversationId) {
          try {
            const res = await fetch('/api/shortlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                journey_id: journeyId,
                conversation_id: conversationId,
                school_id: schoolId,
                school_name: school?.name || '',
                current_phase: activeJourney?.currentPhase || null,
                phase_history: Array.isArray(activeJourney?.phaseHistory) ? activeJourney.phaseHistory : [],
              }),
            });
            if (!res.ok) {
              console.error('[SHORTLIST] Add failed:', res.status);
              toast.error('Failed to save school to shortlist');
            }
          } catch (e) {
            console.error('[SHORTLIST] Add failed:', e.message);
            toast.error('Failed to save school to shortlist');
          }
        } else {
          console.warn('[SHORTLIST] No conversationId available — add not persisted');
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

  // FIX-SL-BLEED-v2: Load shortlist whenever conversation changes.
  // Depends ONLY on currentConversation?.id — not activeJourney?.journeyId.
  // The API derives journey_id from conversation_id server-side, so we don't
  // need to wait for the async activeJourney load (which caused cross-chat bleed).
  useEffect(() => {
    if (!currentConversation?.id) return;
    loadShortlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.id]);

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

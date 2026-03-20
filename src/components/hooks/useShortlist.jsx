import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getShortlistNudge } from '@/components/utils/shortlistNudges';
import { STATES } from '@/lib/stateMachineConfig';
import { ChatShortlist, ChatSession, School, SchoolJourney, FamilyJourney } from '@/lib/entities';

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
  // E48-S4: Cache ChatSession ID per conversation for shortlisted_count updates
  const chatSessionIdCache = useRef({ conversationId: null, chatSessionId: null });

  const loadShortlist = async (journeyId) => {
    const jid = journeyId || activeJourney?.journeyId;
    if (!jid) return;
    try {
      const records = await ChatShortlist.filter({ family_journey_id: jid });
      if (records.length === 0) {
        return;
      }
      const schoolIds = records.map(r => r.school_id).filter(Boolean);
      const schools = await School.filter({ id: { $in: schoolIds } });
      setShortlistData(schools);
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
        try {
          const fetched = await School.filter({ id: schoolId });
          school = fetched?.[0] || null;
        } catch (e) {
          console.error('[SHORTLIST] Failed to fetch school for toggle:', e.message);
        }
      }

      if (isRemoving) {
        setShortlistData(prev => prev.filter(s => s.id !== schoolId));
        setRemovedSchoolIds(prev => [...prev, schoolId]);
        // Remove from ChatShortlist
        if (activeJourney?.journeyId) {
          const existing = await ChatShortlist.filter({ family_journey_id: activeJourney.journeyId, school_id: schoolId });
          for (const rec of existing) {
            await ChatShortlist.delete(rec.id);
          }
        }
      } else {
        trackEvent('shortlisted', { metadata: { schoolName: school?.name } });
        if (school) setShortlistData(prev => [...prev, school]);
        // Add to ChatShortlist
        if (activeJourney?.journeyId) {
          await ChatShortlist.create({
            family_journey_id: activeJourney.journeyId,
            school_id: schoolId,
            addedAt: new Date().toISOString(),
            source: 'manual',
          });
        }
      }

      // E29-004: Sync shortlist to SchoolJourney entity
      ;(async () => {
        try {
          const familyJourney = activeJourney;
          if (!familyJourney) return;

          if (isRemoving) {
            const existing = await SchoolJourney.filter({
              family_journey_id: familyJourney.journeyId,
              school_id: schoolId,
            });
            if (existing.length > 0) {
              await SchoolJourney.update(existing[0].id, { status: 'removed' });
            }
          } else {
            await SchoolJourney.create({
              family_journey_id: familyJourney.journeyId,
              school_id: school?.id || schoolId,
              school_name: school?.name || '',
              status: 'shortlisted',
              addedAt: new Date().toISOString(),
            });
          }

          // E29-015: Phase auto-advancement MATCH → EVALUATE on first shortlist add
          if (!isRemoving && familyJourney.currentPhase === 'MATCH') {
            try {
              const currentHistory = Array.isArray(familyJourney.phaseHistory) ? familyJourney.phaseHistory : [];
              await FamilyJourney.update(familyJourney.journeyId, {
                current_phase: 'EVALUATE',
                phase_history: [...currentHistory, { phase: 'EVALUATE', enteredAt: new Date().toISOString() }],
              });
              console.log('[E29-015] FamilyJourney advanced MATCH → EVALUATE');
            } catch (phaseErr) {
              console.error('[E29-015] Phase advance MATCH→EVALUATE failed:', phaseErr?.message);
            }
          }
        } catch (e) {
          console.error('[E29-004] SchoolJourney sync failed:', e.message, e);
        }
      })();

      // E48-S4: Update ChatSession.shortlisted_count (non-blocking side effect)
      ;(async () => {
        try {
          const convId = currentConversation?.id;
          if (!convId) return;
          let cachedId = chatSessionIdCache.current.conversationId === convId
            ? chatSessionIdCache.current.chatSessionId
            : null;
          if (!cachedId) {
            const sessions = await ChatSession.filter({ chat_history_id: convId });
            if (sessions.length === 0) return;
            cachedId = sessions[0].id;
            chatSessionIdCache.current = { conversationId: convId, chatSessionId: cachedId };
          }
          const newCount = isRemoving ? shortlistData.length - 1 : shortlistData.length + 1;
          await ChatSession.update(cachedId, { shortlisted_count: Math.max(0, newCount) });
        } catch (e) {
          console.error('[E48-S4] Failed to update ChatSession.shortlisted_count:', e.message);
        }
      })();

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
  useEffect(() => {
    if (!activeJourney?.journeyId) { setShortlistData([]); return; }
    loadShortlist(activeJourney.journeyId);
  }, [activeJourney?.journeyId]);

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
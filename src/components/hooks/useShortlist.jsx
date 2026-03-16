import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getShortlistNudge } from '@/components/utils/shortlistNudges';
import { STATES } from '@/pages/stateMachineConfig';
import { base44 } from '@/api/base44Client';

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

  const loadShortlist = async () => {
    if (!activeJourney?.journeyId) return;
    try {
      const records = await base44.entities.ChatShortlist.filter({ familyJourneyId: activeJourney.id });
      if (records.length === 0) {
        setShortlistData([]);
        return;
      }
      const schoolIds = records.map(r => r.schoolId).filter(Boolean);
      const schools = await base44.entities.School.filter({ id: { $in: schoolIds } });
      setShortlistData(schools);
    } catch (error) {
      console.error('Failed to load shortlist:', error);
      setShortlistData([]);
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
          const fetched = await base44.entities.School.filter({ id: schoolId });
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
          const existing = await base44.entities.ChatShortlist.filter({ familyJourneyId: activeJourney.journeyId, schoolId });
          for (const rec of existing) {
            await base44.entities.ChatShortlist.delete(rec.id);
          }
        }
      } else {
        trackEvent('shortlisted', { metadata: { schoolName: school?.name } });
        if (school) setShortlistData(prev => [...prev, school]);
        // Add to ChatShortlist
        if (activeJourney?.journeyId) {
          await base44.entities.ChatShortlist.create({
            familyJourneyId: activeJourney.journeyId,
            schoolId,
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
            const existing = await base44.entities.SchoolJourney.filter({
              familyJourneyId: familyJourney.journeyId,
              schoolId: schoolId,
            });
            if (existing.length > 0) {
              await base44.entities.SchoolJourney.update(existing[0].id, { status: 'removed' });
            }
          } else {
            await base44.entities.SchoolJourney.create({
              familyJourneyId: familyJourney.id,
              schoolId: school?.id || schoolId,
              schoolName: school?.name || '',
              status: 'shortlisted',
              addedAt: new Date().toISOString(),
            });
          }

          // E29-015: Phase auto-advancement MATCH → EVALUATE on first shortlist add
          if (!isRemoving && familyJourney.currentPhase === 'MATCH') {
            try {
              const currentHistory = Array.isArray(familyJourney.phaseHistory) ? familyJourney.phaseHistory : [];
              await base44.entities.FamilyJourney.update(familyJourney.journeyId, {
                currentPhase: 'EVALUATE',
                phaseHistory: [...currentHistory, { phase: 'EVALUATE', enteredAt: new Date().toISOString() }],
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
    if (!activeJourney?.id) return;
    loadShortlist();
  }, [activeJourney?.id]);

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
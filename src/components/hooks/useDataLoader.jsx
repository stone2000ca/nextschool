import { useState, useEffect, useCallback } from 'react';
import { GeneratedArtifact, SchoolAnalysis, FamilyProfile, FamilyJourney, SchoolJourney } from '@/lib/entities';

export function useDataLoader({ user, currentConversation, isAuthenticated }) {
  const [familyProfile, setFamilyProfile] = useState(null);
  const [artifactCache, setArtifactCache] = useState(null);
  const [schoolAnalyses, setSchoolAnalyses] = useState({});
  const [visitedSchoolIds, setVisitedSchoolIds] = useState(new Set());
  const [activeJourney, setActiveJourney] = useState(null);
  const [extractedEntitiesData, setExtractedEntitiesData] = useState({});
  const [restoredSessionData, setRestoredSessionData] = useState(null);

  const loadPreviousArtifacts = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
      // BUG-RN-PERSIST Fix D: Omit conversationId from filter when falsy to handle legacy rows
      const analysisFilter = { userId: user.id };
      if (conversationId) analysisFilter.conversationId = conversationId;
      const [artifacts, analyses] = await Promise.all([
        GeneratedArtifact.filter({ conversationId }),
        user?.id ? SchoolAnalysis.filter(analysisFilter) : Promise.resolve([])
      ]);

      // Build indexed map keyed by schoolId_artifactType
      const TYPE_REMAP = {
        deep_dive_recommendation: 'deep_dive_analysis',
        visit_prep_kit: 'visit_prep',
      };
      const map = {};
      for (const artifact of artifacts) {
        const schoolIds = artifact.schoolIds || [];
        for (const schoolId of schoolIds) {
          const remappedType = TYPE_REMAP[artifact.artifactType] || artifact.artifactType;
          const key = `${schoolId}_${remappedType}`;
          map[key] = artifact.content;
        }
      }

      // E30-007: Build schoolAnalyses map with full record (excluding internal metadata)
      const analysesMap = {};
      const METADATA_KEYS = new Set(['id', 'createdAt', 'updated_date', 'created_by']);
      for (const analysis of analyses) {
        if (analysis.schoolId) {
          const entry = {};
          for (const [k, v] of Object.entries(analysis)) {
            if (!METADATA_KEYS.has(k)) entry[k] = v;
          }
          analysesMap[analysis.schoolId] = entry;
        }
      }
      setSchoolAnalyses(prev => ({ ...analysesMap, ...prev }));
      setArtifactCache(map);
      console.log('[WC6] Artifact cache loaded:', Object.keys(map).length, 'entries', '| SchoolAnalyses:', Object.keys(analysesMap).length);

      // If no analyses found but we have a valid conversation, retry once after 800ms
      // to handle the tiny window where SchoolAnalysis write may still be in flight
      if (analyses.length === 0 && conversationId && user?.id) {
        console.log('[WC6] No SchoolAnalyses found — scheduling one retry in 800ms');
        setTimeout(async () => {
          try {
            const retryAnalyses = await SchoolAnalysis.filter({ userId: user.id, conversationId });
            if (retryAnalyses.length > 0) {
              const retryMap = {};
              for (const analysis of retryAnalyses) {
                if (analysis.schoolId) {
                  const entry = {};
                  for (const [k, v] of Object.entries(analysis)) {
                    if (!METADATA_KEYS.has(k)) entry[k] = v;
                  }
                  retryMap[analysis.schoolId] = entry;
                }
              }
              setSchoolAnalyses(prev => ({ ...retryMap, ...prev }));
              console.log('[WC6] Retry found', Object.keys(retryMap).length, 'SchoolAnalyses');
            }
          } catch (retryErr) {
            console.warn('[WC6] Retry failed:', retryErr.message);
          }
        }, 800);
      }
    } catch (error) {
      console.error('[WC6] Failed to load artifacts:', error);
    }
  }, [user?.id]);

  const loadFamilyProfile = useCallback(async () => {
    if (!user?.id || !currentConversation?.id) return;

    // Guard: if familyProfile already has meaningful data from orchestrateConversation, skip DB fetch
    const METADATA_KEYS = ['id', 'userId', 'conversationId', 'createdAt', 'updated_date', 'created_by'];
    const hasRealData = familyProfile && Object.entries(familyProfile).some(
      ([k, v]) => !METADATA_KEYS.includes(k) && v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
    );
    if (hasRealData) {
      console.log('[loadFamilyProfile] Skipping DB fetch — meaningful data already in state');
      await loadPreviousArtifacts(currentConversation.id);
      return;
    }

    try {
      const profiles = await FamilyProfile.filter({
        userId: user.id,
        conversationId: currentConversation.id
      });

      if (profiles.length > 0) {
        setFamilyProfile(profiles[0]);
      }
    } catch (error) {
      console.error('Failed to load family profile:', error);
    }

    // BUG-RN-PERSIST Fix 2: Always load artifacts regardless of FamilyProfile existence.
    // loadPreviousArtifacts handles empty results gracefully (including 800ms retry).
    await loadPreviousArtifacts(currentConversation.id);
  }, [user?.id, currentConversation?.id, familyProfile, loadPreviousArtifacts]);

  // Load family profile + artifacts when user + conversation are ready
  useEffect(() => {
    if (user?.id && currentConversation?.id) {
      loadFamilyProfile();
    }
  }, [user?.id, currentConversation?.id]);

  // E29-007: Detect active journey on auth, scoped to current chat
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    (async () => {
      try {
        let journey = null;

        if (currentConversation?.id) {
          // Step (a): Try to find journey specifically linked to this chat
          const linked = await FamilyJourney.filter({ userId: user.id, isArchived: false, chatHistoryId: currentConversation.id });
          if (linked.length > 0) {
            journey = linked.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          } else {
            // Step (b): Fallback — only pick unassigned journeys (no chatHistoryId), then stamp
            const all = await FamilyJourney.filter({ userId: user.id, isArchived: false });
            const unassigned = all.filter(j => !j.chatHistoryId);
            if (unassigned.length > 0) {
              journey = unassigned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
              await FamilyJourney.update(journey.id, { chatHistoryId: currentConversation.id });
              journey = { ...journey, chatHistoryId: currentConversation.id };
            }
            // If no unassigned journeys, journey stays null — this chat has no journey yet
          }
        } else {
          // Step (c): No conversation context — just pick most recent journey
          const all = await FamilyJourney.filter({ userId: user.id, isArchived: false });
          if (all.length > 0) {
            journey = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          }
        }

        if (!journey) { setActiveJourney(null); return; }

        const schoolJourneys = await SchoolJourney.filter({ familyJourneyId: journey.id });

        setActiveJourney({
          id: journey.id,
          journeyId: journey.id,
          currentPhase: journey.currentPhase,
          nextAction: journey.nextAction,
          lastSessionSummary: journey.lastSessionSummary,
          consultantId: journey.consultantId,
          isResuming: true, // S169-WC1: E29-RESUMPTION-FIX
          schoolsSummary: schoolJourneys.map(sj => ({
            schoolId: sj.schoolId,
            schoolName: sj.schoolName,
            status: sj.status,
          })),
        });
        console.log('[E29-007] Active journey detected:', journey.id);
      } catch (e) {
        console.error('[E29-007] Journey detection failed:', e.message);
      }
    })();
  }, [isAuthenticated, user?.id, currentConversation?.id]);

  return {
    familyProfile, setFamilyProfile,
    artifactCache, setArtifactCache,
    schoolAnalyses, setSchoolAnalyses,
    visitedSchoolIds, setVisitedSchoolIds,
    activeJourney, setActiveJourney,
    extractedEntitiesData, setExtractedEntitiesData,
    restoredSessionData, setRestoredSessionData,
    loadFamilyProfile,
    loadPreviousArtifacts,
  };
}
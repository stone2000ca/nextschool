import { useState, useEffect, useCallback } from 'react';
import { GeneratedArtifact, SchoolAnalysis, FamilyProfile } from '@/lib/entities';

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
      const analysisFilter = { user_id: user.id };
      if (conversationId) analysisFilter.conversation_id = conversationId;
      const [artifacts, analyses] = await Promise.all([
        GeneratedArtifact.filter({ conversation_id: conversationId }),
        user?.id ? SchoolAnalysis.filter(analysisFilter) : Promise.resolve([])
      ]);

      // Build indexed map keyed by schoolId_artifactType
      const TYPE_REMAP = {
        deep_dive_recommendation: 'deep_dive_analysis',
        visit_prep_kit: 'visit_prep',
      };
      const map = {};
      for (const artifact of artifacts) {
        const schoolIds = artifact.school_ids || [];
        for (const schoolId of schoolIds) {
          const remappedType = TYPE_REMAP[artifact.artifact_type] || artifact.artifact_type;
          const key = `${schoolId}_${remappedType}`;
          map[key] = artifact.content;
        }
      }

      // E30-007: Build schoolAnalyses map with full record (excluding internal metadata)
      const analysesMap = {};
      const METADATA_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'createdBy']);
      for (const analysis of analyses) {
        if (analysis.school_id) {
          const entry = {};
          for (const [k, v] of Object.entries(analysis)) {
            if (!METADATA_KEYS.has(k)) entry[k] = v;
          }
          analysesMap[analysis.school_id] = entry;
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
            const retryAnalyses = await SchoolAnalysis.filter({ user_id: user.id, conversation_id: conversationId });
            if (retryAnalyses.length > 0) {
              const retryMap = {};
              for (const analysis of retryAnalyses) {
                if (analysis.school_id) {
                  const entry = {};
                  for (const [k, v] of Object.entries(analysis)) {
                    if (!METADATA_KEYS.has(k)) entry[k] = v;
                  }
                  retryMap[analysis.school_id] = entry;
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
    const METADATA_KEYS = ['id', 'user_id', 'conversation_id', 'created_at', 'updated_at', 'created_by'];
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
        user_id: user.id,
        conversation_id: currentConversation.id
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
          const linkedRes = await fetch(`/api/family-journey?user_id=${user.id}&is_archived=false&chat_history_id=${currentConversation.id}`);
          const linked = linkedRes.ok ? await linkedRes.json() : [];
          if (linked.length > 0) {
            journey = linked.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          } else {
            // Step (b): Fallback — only pick unassigned journeys (no chat_history_id), then stamp
            const allRes = await fetch(`/api/family-journey?user_id=${user.id}&is_archived=false`);
            const all = allRes.ok ? await allRes.json() : [];
            const unassigned = all.filter(j => !j.chat_history_id);
            if (unassigned.length > 0) {
              journey = unassigned.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
              await fetch('/api/family-journey', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: journey.id, chat_history_id: currentConversation.id }),
              });
              journey = { ...journey, chat_history_id: currentConversation.id };
            }
            // If no unassigned journeys, journey stays null — this chat has no journey yet
          }
        } else {
          // Step (c): No conversation context — just pick most recent journey
          const allRes = await fetch(`/api/family-journey?user_id=${user.id}&is_archived=false`);
          const all = allRes.ok ? await allRes.json() : [];
          if (all.length > 0) {
            journey = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          }
        }

        if (!journey) { setActiveJourney(null); return; }

        const sjRes = await fetch(`/api/school-journeys?family_journey_id=${journey.id}`);
        const schoolJourneys = sjRes.ok ? await sjRes.json() : [];

        setActiveJourney({
          id: journey.id,
          journeyId: journey.id,
          currentPhase: journey.current_phase,
          nextAction: journey.next_action,
          lastSessionSummary: journey.last_session_summary,
          consultantId: journey.consultant_id,
          isResuming: true, // S169-WC1: E29-RESUMPTION-FIX
          schoolsSummary: schoolJourneys.map(sj => ({
            schoolId: sj.school_id,
            schoolName: sj.school_name,
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
'use client';

import { useState, useCallback } from 'react';
import { invokeFunction } from '@/lib/functions';

/**
 * useSchoolResults — Phase 3c
 *
 * Owns school results state: the main search results list, selected school,
 * extra (load-more) schools, priority overrides, left-panel mode,
 * and confirming-school state.
 *
 * Ownership boundary:
 *   useSchoolResults     → school results state + load-more + priority toggles
 *   useSchoolFiltering   → filtering/sorting the schools list
 *   useMessageHandler    → writing schools into state after orchestration
 */
export function useSchoolResults() {
  // ─── Core school results state ──────────────────────────────────
  const [schools, setSchools] = useState([]);
  const [previousSearchResults, setPreviousSearchResults] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);

  // ─── Extra schools (load-more) ──────────────────────────────────
  const [extraSchools, setExtraSchools] = useState([]);
  const [extraSchoolsPage, setExtraSchoolsPage] = useState(1);
  const [extraSchoolsHasMore, setExtraSchoolsHasMore] = useState(true);
  const [extraSchoolsLoading, setExtraSchoolsLoading] = useState(false);
  const [extraSchoolsError, setExtraSchoolsError] = useState(null);

  // ─── Priority overrides { [rowId]: 'musthave' | 'nicetohave' | 'dontcare' } ──
  const [priorityOverrides, setPriorityOverrides] = useState({});

  // ─── Deep-dive confirmation state ───────────────────────────────
  const [confirmingSchool, setConfirmingSchool] = useState(null);

  // ─── Animation / UI mode ────────────────────────────────────────
  const [schoolsAnimKey, setSchoolsAnimKey] = useState(0);
  const [leftPanelMode, setLeftPanelMode] = useState('grid'); // 'grid' | 'comparison'

  // ─── Priority toggle handler ────────────────────────────────────
  const handlePriorityToggle = useCallback((rowId) => {
    setPriorityOverrides(prev => {
      const CYCLE = ['musthave', 'nicetohave', 'dontcare'];
      const current = prev[rowId] || 'nicetohave';
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      const updated = { ...prev, [rowId]: next };
      // Guard: at least 1 priority must remain non-dontcare
      const allDontCare = Object.values(updated).every(v => v === 'dontcare');
      if (allDontCare) return prev;
      return updated;
    });
  }, []);

  // ─── Load more nearby schools ───────────────────────────────────
  // Accepts dependencies at call time to avoid stale closures from
  // cross-hook state (familyProfile, shortlistData, etc.)
  const loadMoreSchools = useCallback(async ({ conversationContext, familyProfile, userLocation, shortlistData, user: currentUser } = {}) => {
    const lat = conversationContext?.resolvedLat || familyProfile?.resolvedLat || userLocation?.lat;
    const lng = conversationContext?.resolvedLng || familyProfile?.resolvedLng || userLocation?.lng;
    if (!lat || !lng) {
      setExtraSchoolsError('no_location');
      return;
    }
    setExtraSchoolsLoading(true);
    setExtraSchoolsError(null);
    try {
      const displayedIds = (schools || []).map(s => s.id);
      const shortlistIds = shortlistData?.map(s => s.id) || currentUser?.shortlist || [];
      const extraIds = extraSchools.map(s => s.id);
      const excludeIds = [...new Set([...displayedIds, ...shortlistIds, ...extraIds])];

      const result = await invokeFunction('getNearbySchools', {
        lat, lng, excludeIds,
        gradeMin: familyProfile?.child_grade || null,
        maxTuition: familyProfile?.max_tuition || null,
        dealbreakers: familyProfile?.dealbreakers || [],
        familyGender: familyProfile?.child_gender || null,
        schoolGenderExclusions: familyProfile?.school_gender_exclusions || [],
        schoolGenderPreference: familyProfile?.school_gender_preference || null,
        page: extraSchoolsPage,
        pageSize: 20,
      });
      const data = result.data || result;
      setExtraSchools(prev => [...prev, ...(data.schools || [])]);
      setExtraSchoolsHasMore(data.hasMore || false);
      setExtraSchoolsPage(prev => prev + 1);
    } catch (err) {
      console.error('[LOAD MORE] Error:', err);
      setExtraSchoolsError('fetch_failed');
    } finally {
      setExtraSchoolsLoading(false);
    }
  }, [extraSchoolsPage, schools, extraSchools]);

  // ─── Reset all school state (for new conversation) ──────────────
  const resetSchoolState = useCallback(() => {
    setSchools([]);
    setSelectedSchool(null);
    setPreviousSearchResults([]);
    setExtraSchools([]);
    setExtraSchoolsPage(1);
    setExtraSchoolsHasMore(true);
    setExtraSchoolsLoading(false);
    setExtraSchoolsError(null);
    setPriorityOverrides({});
    setConfirmingSchool(null);
    setSchoolsAnimKey(0);
    setLeftPanelMode('grid');
  }, []);

  return {
    // Core state
    schools, setSchools,
    previousSearchResults, setPreviousSearchResults,
    selectedSchool, setSelectedSchool,

    // Extra schools (load-more)
    extraSchools, setExtraSchools,
    extraSchoolsPage, setExtraSchoolsPage,
    extraSchoolsHasMore, setExtraSchoolsHasMore,
    extraSchoolsLoading,
    extraSchoolsError,
    loadMoreSchools,

    // Priority overrides
    priorityOverrides, setPriorityOverrides,
    handlePriorityToggle,

    // Deep-dive confirmation
    confirmingSchool, setConfirmingSchool,

    // Animation / UI mode
    schoolsAnimKey, setSchoolsAnimKey,
    leftPanelMode, setLeftPanelMode,

    // Reset
    resetSchoolState,
  };
}

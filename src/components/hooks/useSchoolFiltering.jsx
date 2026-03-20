import { useState, useCallback } from 'react';
import { calculateHaversineDistance, applyReligiousFilter } from '../utils/filterUtils';

/**
 * Hook for school filtering and distance calculation.
 *
 * @param {Array} schools - Current school list
 * @param {Object} conversationContext - Current conversation context (for profile-based filtering)
 * @returns {Object} { filteredSchools, showDistances, applyDistances, resetSort }
 */
export function useSchoolFiltering(schools, conversationContext) {
  const [showDistances, setShowDistances] = useState(false);

  const [filterOverrides, setFilterOverrides] = useState({
    maxTuition: null,
    childGrade: null,
    dealbreakers: null,
    boardingOnly: null,
    genderFilter: null,
    maxDistanceKm: null,
    curriculum: null,  // E41-S7
    religiousAffiliation: null,  // E41-S7
  });

  const resetFilterOverrides = useCallback(() => {
    setFilterOverrides({
      maxTuition: null,
      childGrade: null,
      dealbreakers: null,
      boardingOnly: null,
      genderFilter: null,
      maxDistanceKm: null,
      curriculum: null,  // E41-S7
      religiousAffiliation: null,  // E41-S7
    });
  }, []);

  const getFilteredSchools = useCallback(() => {
    try {
      if (!schools || schools.length === 0) return schools || [];

      let filtered = [...schools];

      // Profile-based filtering
      try {
        const profile = conversationContext?.familyProfile;

        // E31-005: Override resolution — override !== null takes priority over familyProfile
        const effectiveChildGrade = filterOverrides.childGrade !== null ? filterOverrides.childGrade : profile?.child_grade;
        const effectiveMaxTuition = filterOverrides.maxTuition !== null ? filterOverrides.maxTuition : profile?.max_tuition;
        const effectiveDealbreakers = filterOverrides.dealbreakers !== null ? filterOverrides.dealbreakers : profile?.dealbreakers;

        // Grade Filter
        const childGrade = effectiveChildGrade;
        if (childGrade !== null && childGrade !== undefined) {
          const gradeNum = typeof childGrade === 'number' ? childGrade : parseInt(String(childGrade));
          if (!isNaN(gradeNum)) {
            filtered = filtered.filter(school => {
              if (!school?.highest_grade && school?.highest_grade !== 0) return true;
              return school.highest_grade >= gradeNum;
            });
            console.log('[FILTER] Grade:', gradeNum, 'Schools:', filtered.length);
          }
        }

        // Budget Filter
        const maxBudget = effectiveMaxTuition;
        if (maxBudget && maxBudget !== 'unlimited') {
          const budgetNum = typeof maxBudget === 'number' ? maxBudget : parseInt(String(maxBudget));
          if (!isNaN(budgetNum)) {
            filtered = filtered.filter(school => {
              const tuition = school?.tuition || school?.day_tuition;
              if (!tuition) return true;
              return tuition <= budgetNum;
            });
            console.log('[FILTER] Budget:', budgetNum, 'Schools:', filtered.length);
          }
        }

        // Religious Dealbreaker Filter
        // E31-006: Now uses canonical applyReligiousFilter from filterUtils (aligned with server)
        try {
          const beforeCount = filtered.length;
          filtered = filtered.filter(school => applyReligiousFilter(school, { ...profile, dealbreakers: effectiveDealbreakers }, null));
          if (filtered.length !== beforeCount) {
            console.log('[FILTER] Religious dealbreaker: filtered from', beforeCount, 'to', filtered.length, 'schools');
          }
        } catch (religiousFilterError) {
          console.error('[RELIGIOUS FILTER] Error, skipping religious filter:', religiousFilterError);
        }

        // E41-S7: boardingOnly filter
        if (filterOverrides.boardingOnly === true) {
          const before = filtered.length;
          filtered = filtered.filter(s => s.boarding_available === true);
          console.log('[FILTER] boardingOnly: filtered from', before, 'to', filtered.length);
        }

        // E41-S7: genderFilter
        if (filterOverrides.genderFilter) {
          const gf = filterOverrides.genderFilter.toLowerCase();
          const GIRLS_KEYWORDS = ['all-girls', 'girls only', 'girls', 'female only', 'all girls'];
          const BOYS_KEYWORDS  = ['all-boys',  'boys only',  'boys',  'male only',  'all boys'];
          const before = filtered.length;
          filtered = filtered.filter(s => {
            const gp = (s.gender_policy || '').toLowerCase();
            if (gf === 'girls' || gf === 'all-girls') return GIRLS_KEYWORDS.some(k => gp.includes(k));
            if (gf === 'boys'  || gf === 'all-boys')  return BOYS_KEYWORDS.some(k => gp.includes(k));
            if (gf === 'co-ed' || gf === 'coed')      return !GIRLS_KEYWORDS.some(k => gp.includes(k)) && !BOYS_KEYWORDS.some(k => gp.includes(k));
            return true;
          });
          console.log('[FILTER] genderFilter:', filterOverrides.genderFilter, 'filtered from', before, 'to', filtered.length);
        }

        // E41-S7: curriculum filter
        if (filterOverrides.curriculum) {
          const cf = filterOverrides.curriculum.toLowerCase();
          const before = filtered.length;
          filtered = filtered.filter(s =>
            Array.isArray(s.curriculum) && s.curriculum.some(c => c.toLowerCase().includes(cf))
          );
          console.log('[FILTER] curriculum:', filterOverrides.curriculum, 'filtered from', before, 'to', filtered.length);
        }

        // E41-S7: religiousAffiliation filter
        if (filterOverrides.religiousAffiliation) {
          const ra = filterOverrides.religiousAffiliation.toLowerCase();
          const before = filtered.length;
          filtered = filtered.filter(s =>
            s.faith_based && s.faith_based.toLowerCase().includes(ra)
          );
          console.log('[FILTER] religiousAffiliation:', filterOverrides.religiousAffiliation, 'filtered from', before, 'to', filtered.length);
        }

      } catch (filterError) {
        console.error('[FILTER] Error applying filters, showing all schools:', filterError);
        filtered = [...schools];
      }

      return filtered;

    } catch (error) {
      console.error('[FILTER] Critical error, returning all schools:', error);
      return schools || [];
    }
  }, [schools, conversationContext, filterOverrides]);

  /**
   * Calculate and apply distances from a user location to all schools.
   * Returns the sorted-by-distance school list (caller should setSchools with the result).
   */
  const applyDistances = useCallback((location, schoolList) => {
    const schoolsWithDistance = schoolList.map(school => {
      if (school.lat && school.lng) {
        const distance = calculateHaversineDistance(
          location.lat,
          location.lng,
          school.lat,
          school.lng
        );
        return { ...school, distanceKm: distance };
      }
      return school;
    });

    const sorted = schoolsWithDistance.sort((a, b) =>
      (a.distanceKm || Infinity) - (b.distanceKm || Infinity)
    );

    setShowDistances(true);
    return sorted;
  }, []);

  /**
   * Stable no-op — sort has been removed; kept for call-site compatibility.
   */
  const resetSort = useCallback(() => {}, []);

  return {
    filteredSchools: getFilteredSchools(),
    showDistances,
    applyDistances,
    resetSort,
    filterOverrides,
    setFilterOverrides,
    resetFilterOverrides,
  };
}
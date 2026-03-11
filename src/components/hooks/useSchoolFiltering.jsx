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
  });

  const resetFilterOverrides = useCallback(() => {
    setFilterOverrides({
      maxTuition: null,
      childGrade: null,
      dealbreakers: null,
      boardingOnly: null,
      genderFilter: null,
      maxDistanceKm: null,
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
        const effectiveChildGrade = filterOverrides.childGrade !== null ? filterOverrides.childGrade : profile?.childGrade;
        const effectiveMaxTuition = filterOverrides.maxTuition !== null ? filterOverrides.maxTuition : profile?.maxTuition;
        const effectiveDealbreakers = filterOverrides.dealbreakers !== null ? filterOverrides.dealbreakers : profile?.dealbreakers;

        // Grade Filter
        const childGrade = effectiveChildGrade;
        if (childGrade !== null && childGrade !== undefined) {
          const gradeNum = typeof childGrade === 'number' ? childGrade : parseInt(String(childGrade));
          if (!isNaN(gradeNum)) {
            filtered = filtered.filter(school => {
              if (!school?.highestGrade && school?.highestGrade !== 0) return true;
              return school.highestGrade >= gradeNum;
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
              const tuition = school?.tuition || school?.dayTuition;
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
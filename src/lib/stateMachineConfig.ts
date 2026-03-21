/**
 * State Machine Configuration — Read-Only Constants
 *
 * Pure data and helper functions for conversation state and discovery progress.
 * All state transitions are computed server-side in orchestrate.ts.
 */

export const STATES = {
  WELCOME: 'WELCOME',
  DISCOVERY: 'DISCOVERY',
  RESULTS: 'RESULTS',
  DEEP_DIVE: 'DEEP_DIVE'
} as const;

export const PROGRESS_WEIGHTS = {
  childName: 0.05,
  grade: 0.20,
  location: 0.25,
  budget: 0.15,
  curriculumOrType: 0.15,
  priorities: 0.10,
  dealbreakers: 0.10
};

/**
 * Check if tier 1 data (minimum required) is met
 */
export const checkTier1 = (entities: Record<string, unknown> | null | undefined): boolean => {
  if (!entities) return false;

  const hasLocation = !!entities.location_area;
  const hasGradeOrCurriculum = !!entities.child_grade ||
    (Array.isArray(entities.curriculum_preference) && entities.curriculum_preference.length > 0) ||
    !!entities.school_type_label;

  return hasLocation && hasGradeOrCurriculum;
};

/**
 * Calculate weighted discovery progress (0 to 1)
 */
export const getProgress = (entities: Record<string, unknown> | null | undefined): number => {
  if (!entities) return 0;

  let progress = 0;

  if (entities.child_name) {
    progress += PROGRESS_WEIGHTS.childName;
  }

  if (entities.child_grade !== null && entities.child_grade !== undefined) {
    progress += PROGRESS_WEIGHTS.grade;
  }

  if (entities.location_area) {
    progress += PROGRESS_WEIGHTS.location;
  }

  if (entities.max_tuition || entities.budgetRange) {
    progress += PROGRESS_WEIGHTS.budget;
  }

  if (
    (Array.isArray(entities.curriculum_preference) && entities.curriculum_preference.length > 0) ||
    entities.school_type_label
  ) {
    progress += PROGRESS_WEIGHTS.curriculumOrType;
  }

  if (Array.isArray(entities.priorities) && entities.priorities.length > 0) {
    progress += PROGRESS_WEIGHTS.priorities;
  }

  if (Array.isArray(entities.dealbreakers) && entities.dealbreakers.length > 0) {
    progress += PROGRESS_WEIGHTS.dealbreakers;
  }

  return Math.min(progress, 1.0);
};

/**
 * Get human-readable progress label based on progress percentage
 */
export const getProgressLabel = (progress: number): string => {
  if (progress <= 0.30) {
    return 'Getting to know your family...';
  } else if (progress <= 0.60) {
    return 'Understanding your priorities...';
  } else if (progress <= 0.89) {
    return 'Almost ready to find schools...';
  } else {
    return 'Ready to build your Family Brief';
  }
};

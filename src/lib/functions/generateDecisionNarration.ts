// Function: generateDecisionNarration
// Purpose: Generate honest tradeoff analysis and decision narration with optional debrief data
// Entities: FamilyProfile, ComparisonMatrix (via input), SchoolJourney (via input)
// Last Modified: 2026-03-08

export async function generateDecisionNarrationLogic(params: {
  schools: any[];
  comparisonMatrix: any;
  familyProfile: any;
  schoolJourneys: any[];
  isPremiumUser: boolean;
}) {
  const { schools, comparisonMatrix, familyProfile, schoolJourneys, isPremiumUser } = params;

  // E29-017: Return null immediately for non-premium users to avoid LLM cost
  if (!isPremiumUser) {
    return null;
  }

  // Compute whether we have post-visit debrief data
  const hasDebriefs = Array.isArray(schoolJourneys) && schoolJourneys.some((j: any) => j?.postVisitFitLabel || j?.visitVerdict || (j?.revisedConcerns?.length > 0));

  // Return default response if insufficient personalized data
  if (!familyProfile && (!Array.isArray(schoolJourneys) || schoolJourneys.length === 0)) {
    return {
      hasDebriefs: false,
      narrative: null,
      tradeoffs: [],
      nextStep: null,
      limitationsNotice: 'Not enough personalized data available for tradeoff analysis.'
    };
  }

  try {
    // Build briefSummary from familyProfile
    const briefSummary = familyProfile ? {
      priorities: familyProfile.priorities || [],
      dealbreakers: familyProfile.dealbreakers || [],
      childAge: familyProfile.childAge || null,
      childGrade: familyProfile.childGrade || null,
      learningDifferences: familyProfile.learningDifferences || [],
      budgetRange: familyProfile.budgetRange || null,
      maxTuition: familyProfile.maxTuition || null,
      goals: familyProfile.interests || []
    } : null;

    // Build comparisonSummary from comparisonMatrix dimensions
    const comparisonSummary = comparisonMatrix?.dimensions?.map((dim: any) => ({
      category: dim.category,
      label: dim.label,
      values: dim.values,
      relevance: dim.relevance || null
    })) || [];

    // Build debriefSummary from schoolJourneys if available
    let debriefSummary: any = null;
    if (hasDebriefs && Array.isArray(schoolJourneys)) {
      debriefSummary = schoolJourneys.map((j: any) => ({
        schoolId: j.schoolId,
        schoolName: j.schoolName || 'Unknown School',
        status: j.status || 'MATCHED',
        postVisitFitLabel: j.postVisitFitLabel || null,
        visitVerdict: j.visitVerdict || null,
        revisedStrengths: j.revisedStrengths || [],
        revisedConcerns: j.revisedConcerns || []
      }));
    }

    // TODO: Replace with your LLM call implementation
    // The prompt is preserved in the original file for reference
    console.log('[E29-017] LLM decision narration placeholder - implement with your LLM service');

    // Placeholder response
    const output = {
      hasDebriefs,
      narrative: null,
      tradeoffs: [],
      nextStep: null,
      limitationsNotice: 'LLM integration pending — tradeoff analysis will be available soon.'
    };

    console.log('[E29-017] Decision narration generated successfully');
    return output;
  } catch (error: any) {
    console.error('[E29-017] generateDecisionNarration failed:', error.message);
    return null;
  }
}

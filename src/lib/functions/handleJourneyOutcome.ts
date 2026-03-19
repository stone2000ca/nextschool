import { FamilyJourney } from '@/lib/entities-server'

export async function handleJourneyOutcome(params: {
  journeyId: string
  outcome: string
  outcomeSchoolId: string
  userId: string
}) {
  const { journeyId, outcome, outcomeSchoolId, userId } = params;

  // 1. Validate inputs
  if (!journeyId || !outcome || !outcomeSchoolId || !userId) {
    throw Object.assign(
      new Error('Missing required fields: journeyId, outcome, outcomeSchoolId, userId'),
      { statusCode: 400 }
    );
  }

  const validOutcomes = ['ENROLLED', 'DEFERRED', 'ABANDONED'];
  if (!validOutcomes.includes(outcome)) {
    throw Object.assign(
      new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`),
      { statusCode: 400 }
    );
  }

  // Only ENROLLED is implemented in v1
  if (outcome !== 'ENROLLED') {
    throw Object.assign(
      new Error(`Outcome '${outcome}' is not yet implemented. Only ENROLLED is supported in v1.`),
      { statusCode: 501 }
    );
  }

  // 2. Fetch FamilyJourney
  let journey: any = null;
  try {
    journey = await FamilyJourney.get(journeyId);
  } catch (fetchErr: any) {
    console.warn('[E29-019] FamilyJourney fetch failed:', fetchErr.message);
  }

  if (!journey) {
    throw Object.assign(new Error('Journey not found'), { statusCode: 404 });
  }

  // 3. Validate ownership and state
  if (journey.user_id !== userId) {
    throw Object.assign(
      new Error('Unauthorized: userId does not match journey owner'),
      { statusCode: 403 }
    );
  }

  if (journey.is_archived === true) {
    throw Object.assign(new Error('Journey is already archived'), { statusCode: 409 });
  }

  // 4. Parse schoolJourneys and validate outcomeSchoolId exists
  let schoolJourneys = journey.school_journeys || [];
  if (typeof schoolJourneys === 'string') {
    try {
      schoolJourneys = JSON.parse(schoolJourneys);
    } catch (parseErr: any) {
      console.warn('[E29-019] Failed to parse schoolJourneys:', parseErr.message);
      schoolJourneys = [];
    }
  }

  const matchingSchool = schoolJourneys.find((sj: any) => sj.school_id === outcomeSchoolId);
  if (!matchingSchool) {
    throw Object.assign(
      new Error(`School ID ${outcomeSchoolId} not found in journey school_journeys`),
      { statusCode: 422 }
    );
  }

  // 5. Update the matching SchoolJourneyItem status
  const updatedSchoolJourneys = schoolJourneys.map((sj: any) =>
    sj.school_id === outcomeSchoolId ? { ...sj, status: 'ENROLLED' } : sj
  );

  // 6. WRITE SEQUENCE: outcome fields FIRST, then archive SECOND
  const outcomeDate = new Date().toISOString();

  try {
    // 6a. First update: set outcome fields
    await FamilyJourney.update(journeyId, {
      outcome,
      outcome_school_id: outcomeSchoolId,
      outcome_date: outcomeDate,
      current_phase: 'ACT',
      school_journeys: updatedSchoolJourneys
    });
    console.log('[E29-019] Outcome fields updated:', { journeyId, outcome, outcomeSchoolId, outcomeDate });

    // 6b. Second update: archive the journey
    await FamilyJourney.update(journeyId, {
      is_archived: true
    });
    console.log('[E29-019] Journey archived:', journeyId);
  } catch (updateErr: any) {
    console.error('[E29-019] FamilyJourney update failed:', updateErr.message);
    throw Object.assign(new Error('Failed to update journey outcome'), { statusCode: 500 });
  }

  // 7. Build congratulations response
  const response = {
    success: true,
    outcome,
    schoolName: matchingSchool.school_name,
    childName: journey.child_name,
    message: `Congratulations! ${journey.child_name} is heading to ${matchingSchool.school_name}!`,
    journeyId,
    outcomeDate
  };

  console.log('[E29-019] Outcome recorded successfully:', response);

  return response;
}

import { createArtifact } from '@/lib/api/entities-api';
import { invokeFunction } from '@/lib/functions';

/**
 * E11b Phase 1 + E49-S4B: AI-narrated comparison synthesis
 * Now calls backend generateComparisonNarrative which:
 *   - Uses deep-dive artifacts, match explanations, visit debriefs
 *   - Caches per (family_profile_id, sorted_school_ids, profile_hash)
 * Falls back to client-side invokeLLM if backend call fails.
 *
 * @param {Array} comparedSchools - Schools being compared
 * @param {Object} familyProfile - Family profile with priorities
 * @param {Set} visitedSchoolIds - Set of school IDs that have been visited
 * @param {string} selectedConsultant - Consultant name ('Jackie' or 'Liam')
 * @param {Function} setMessages - setState for chat messages
 * @param {Function} setComparisonMatrix - setState for comparison matrix
 * @param {string} conversationId - Current conversation ID (E49-S4B)
 * @param {string} userId - Current user ID (E49-S4B)
 */
export async function handleNarrateComparison({
  comparedSchools,
  familyProfile,
  visitedSchoolIds,
  selectedConsultant,
  setMessages,
  setComparisonMatrix,
  conversationId,
  userId,
}) {
  const schoolIds = comparedSchools.map(s => s.id).filter(Boolean);

  // Inject a loading placeholder first
  const loadingMsg = {
    role: 'assistant',
    content: '...',
    timestamp: new Date().toISOString(),
    isNudge: true,
  };
  setMessages(prev => [...prev, loadingMsg]);

  try {
    // E49-S4B: Try backend narrative generation (cached, enriched with deep-dives)
    let narrativeText = null;
    let usedBackend = false;

    try {
      const backendResult = await invokeFunction('generateComparisonNarrative', {
        schoolIds,
        familyProfileId: familyProfile?.id || null,
        userId: userId || null,
        conversationId: conversationId || null,
        consultantName: selectedConsultant,
      });

      if (backendResult?.narrative) {
        narrativeText = backendResult.narrative;
        usedBackend = true;
        console.log('[E49-S4B] Comparison narrative from backend', backendResult.fromCache ? '(CACHED)' : '(FRESH)');
      }
    } catch (backendErr) {
      console.warn('[E49-S4B] Backend narrative failed, falling back to client-side LLM:', backendErr.message);
    }

    // Fallback: client-side LLM call (original E11b flow)
    if (!narrativeText) {
      const result = await generateNarrativeClientSide({
        comparedSchools,
        familyProfile,
        visitedSchoolIds,
        selectedConsultant,
      });
      narrativeText = result.narrativeText;

      // Also set comparison matrix from client-side result
      if (result.comparisonMatrix) {
        const correctedMatrix = {
          ...result.comparisonMatrix,
          schools: comparedSchools.map(s => ({
            id: s.id,
            name: s.name,
            isVisited: visitedSchoolIds.has(s.id)
          }))
        };
        setComparisonMatrix(correctedMatrix);
      }
    }

    // Replace loading placeholder with narrative
    setMessages(prev => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].content === '...') {
          updated[i] = { ...updated[i], content: narrativeText, isNudge: false };
          break;
        }
      }
      return updated;
    });

    // Persist comparison artifact (fire-and-forget)
    if (familyProfile?.id) {
      (async () => {
        try {
          await createArtifact({
            artifact_type: 'comparison',
            family_profile_id: familyProfile.id,
            content: JSON.stringify({ narrative: narrativeText, usedBackend }),
            school_ids: schoolIds,
            created_date: new Date().toISOString()
          });
        } catch (artifactError) {
          console.warn('[E49-S4B] Failed to persist comparison artifact (non-blocking):', artifactError.message);
        }
      })();
    }
  } catch (e) {
    console.error('[E49-S4B] Comparison synthesis failed:', e);
    setMessages(prev => prev.filter(m => m.content !== '...'));
  }
}

/**
 * Original E11b client-side LLM narrative generation (fallback)
 */
async function generateNarrativeClientSide({ comparedSchools, familyProfile, visitedSchoolIds, selectedConsultant }) {
  const isJackie = selectedConsultant === 'Jackie';
  const persona = isJackie
    ? 'You are Jackie, a warm and empathetic private school consultant. Speak naturally, like a trusted advisor.'
    : 'You are Liam, a direct and analytical private school consultant. Speak concisely and clearly.';

  const briefSummary = familyProfile ? [
    familyProfile.priorities?.length ? `Priorities: ${familyProfile.priorities.join(', ')}` : '',
    familyProfile.max_tuition ? `Budget: up to $${familyProfile.max_tuition.toLocaleString()}` : '',
    familyProfile.location_area ? `Location: ${familyProfile.location_area}` : '',
    familyProfile.learning_differences?.length ? `Learning needs: ${familyProfile.learning_differences.join(', ')}` : '',
    familyProfile.boarding_preference ? `Boarding preference: ${familyProfile.boarding_preference}` : '',
  ].filter(Boolean).join('. ') : '';

  const schoolSummaries = comparedSchools.map(s => {
    const tuition = s.day_tuition ?? s.tuition;
    return [
      `School: ${s.name}`,
      s.city ? `City: ${s.city}` : '',
      s.distanceKm != null ? `Distance: ${s.distanceKm.toFixed(1)} km` : '',
      tuition ? `Tuition: $${tuition.toLocaleString()} ${s.currency || ''}` : '',
      s.curriculum?.length ? `Curriculum: ${s.curriculum.join(', ')}` : '',
      s.genderPolicy ? `Gender: ${s.genderPolicy}` : '',
      s.boardingAvailable != null ? `Boarding: ${s.boardingAvailable ? 'Yes' : 'No'}` : '',
      s.avgClassSize ? `Avg class size: ${s.avgClassSize}` : '',
      s.enrollment ? `Enrollment: ${s.enrollment}` : '',
      s.studentTeacherRatio ? `Student-teacher ratio: ${s.studentTeacherRatio}` : '',
      s.artsPrograms?.length ? `Arts: ${s.artsPrograms.join(', ')}` : '',
      s.sportsPrograms?.length ? `Sports: ${s.sportsPrograms.join(', ')}` : '',
      s.universityPlacements ? `University placements: ${s.universityPlacements}` : '',
      s.specializations?.length ? `Specializations: ${s.specializations.join(', ')}` : '',
      s.highlights?.length ? `Highlights: ${s.highlights.join('; ')}` : '',
    ].filter(Boolean).join(', ');
  }).join('\n');

  const standardDimensions = [
    { key: 'budget', label: 'Budget Fit' },
    { key: 'commute', label: 'Commute' },
    { key: 'classSize', label: 'Class Size' }
  ];
  const priorityDimensions = (familyProfile?.priorities || []).map(p => ({
    key: p.toLowerCase().replace(/\s+/g, '_'),
    label: p,
    source: 'family_priority'
  }));
  const allDimensions = [...standardDimensions, ...priorityDimensions];

  const response_json_schema = {
    type: 'object',
    properties: {
      narrative: {
        type: 'string',
        description: 'Short (3-5 sentence) synthesis paragraph comparing the schools'
      },
      comparisonMatrix: {
        type: 'object',
        properties: {
          schools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                isVisited: { type: 'boolean' }
              }
            }
          },
          dimensions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                source: { type: 'string', enum: ['standard', 'family_priority'] }
              }
            }
          },
          cells: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['match', 'unknown', 'mismatch'] },
                  value: { type: 'string' },
                  commentary: { type: 'string' }
                }
              }
            }
          },
          tradeOffs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                schoolId: { type: 'string' },
                text: { type: 'string' }
              }
            }
          }
        }
      }
    },
    required: ['narrative', 'comparisonMatrix']
  };

  const prompt = `${persona}

**CRITICAL: You are comparing ONLY these ${comparedSchools.length} schools. Do NOT mention, suggest, or include any other schools.**

Schools to compare (and ONLY these schools):
${schoolSummaries}

Family brief context: ${briefSummary || 'Not provided'}

Family Priorities (use as dimensions for evaluation): ${familyProfile?.priorities?.join(', ') || 'Not specified'}

**Task 1: Write Narrative**
Write a SHORT (3–5 sentence) synthesis paragraph comparing these schools for this specific family.
- Highlight the most meaningful differences
- Call out tradeoffs relevant to their priorities/budget
- End with a practical suggestion or question
- Do NOT use bullet points. Write as flowing conversational prose.
- Do NOT repeat the school names in a list. Weave them naturally into the narrative.

**Task 2: Generate Comparison Matrix**
For each school and each dimension listed below, determine:
- status: 'match' (data confirms the priority/need is met), 'unknown' (insufficient data to evaluate), or 'mismatch' (data shows it does not meet the need)
- value: brief factual data point (e.g. "$45,000", "25 min drive", "avg 12 students")
- commentary: 1-sentence interpretation in context of family brief

Dimensions to evaluate:
${allDimensions.map(d => `- ${d.label} (${d.source})`).join('\n')}

Standard dimensions context:
- Budget Fit: Compare tuition to family's max budget
- Commute: Evaluate distance against location preference
- Class Size: Compare avgClassSize to typical preferences

**CRITICAL: The comparisonMatrix.schools array MUST contain EXACTLY these ${comparedSchools.length} schools and no others. Use these school IDs: ${comparedSchools.map(s => s.id).join(', ')}**

For each school, identify 1-2 key trade-offs worth mentioning (e.g., "Higher cost but stronger program").`;

  const result = await invokeFunction('invokeLLM', {
    prompt,
    response_json_schema
  }).then(r => r.data || r);

  return {
    narrativeText: result?.narrative || 'Unable to generate comparison.',
    comparisonMatrix: result?.comparisonMatrix || null,
  };
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const { familyProfile, schools } = await req.json();

    if (!familyProfile || !schools || schools.length === 0) {
      return Response.json({ 
        explanations: schools?.map(s => ({ schoolId: s.id, matches: [] })) || [] 
      });
    }

    // Build context about the family
    const familyContext = `
Child's Name: ${familyProfile.childName || 'Not specified'}
Grade Level: ${familyProfile.childGrade}
Academic Strengths: ${familyProfile.academicStrengths?.join(', ') || 'Not specified'}
Academic Struggles: ${familyProfile.academicStruggles?.join(', ') || 'None mentioned'}
Interests: ${familyProfile.interests?.join(', ') || 'Not specified'}
Personality Traits: ${familyProfile.personalityTraits?.join(', ') || 'Not specified'}
Learning Style: ${familyProfile.learningStyle || 'Not specified'}
Priorities: ${familyProfile.priorities?.join(', ') || 'Not specified'}
Budget: $${familyProfile.maxTuition || 'Not specified'} per year
Location: ${familyProfile.locationArea || 'Not specified'}
Commute Tolerance: ${familyProfile.commuteToleranceMinutes || 'Not specified'} minutes
Curriculum Preferences: ${familyProfile.curriculumPreference?.join(', ') || 'Not specified'}
Boarding Preference: ${familyProfile.boardingPreference || 'Not specified'}
Deal Breakers: ${familyProfile.dealbreakers?.join(', ') || 'None mentioned'}
`;

    const schoolsList = schools.map(s => `
- ${s.name} (${s.city}, ${s.provinceState})
  Curriculum: ${s.curriculumType}
  Tuition: $${s.tuition}
  Specializations: ${s.specializations?.join(', ') || 'General'}
  Gender Policy: ${s.genderPolicy || 'Not specified'}
  Class Size: ${s.avgClassSize || 'Not specified'}
  Financial Aid: ${s.financialAidAvailable ? 'Yes' : 'No'}
  Sports: ${s.sportsPrograms?.slice(0, 3).join(', ') || 'Not specified'}
  Arts: ${s.artsPrograms?.slice(0, 3).join(', ') || 'Not specified'}
  Distance: ${s.distanceKm ? s.distanceKm.toFixed(1) + ' km' : 'Not calculated'}
`).join('\n');

    const prompt = `You are matching schools to a family's needs and preferences.

FAMILY PROFILE:
${familyContext}

SCHOOLS TO MATCH:
${schoolsList}

For EACH school, provide exactly:
1. Two positive match reasons (things the school offers that align with family needs/interests)
2. One honest tradeoff/consideration (something that might not be perfect, but is realistic)

Use the child's actual name ("${familyProfile.childName || 'the student'}") in explanations.
Make reasons specific and personalized.
Keep each explanation short (1 sentence, ~10 words).
For positive matches: emphasize alignment with interests, academic strengths, priorities
For tradeoffs: mention realistic concerns (distance, tuition level, size, etc.) - NOT dealbreakers

Return ONLY a JSON array with NO additional text:
[
  {
    "schoolId": "school-id-1",
    "matches": [
      { "type": "positive", "text": "Strong arts program for Emma" },
      { "type": "positive", "text": "Small class sizes align with preference" },
      { "type": "tradeoff", "text": "Tuition is at upper end of budget" }
    ]
  }
]`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          explanations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                schoolId: { type: "string" },
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["positive", "tradeoff"] },
                      text: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Fallback: ensure all schools have explanations
    const explanationMap = {};
    if (result.explanations && Array.isArray(result.explanations)) {
      result.explanations.forEach(exp => {
        explanationMap[exp.schoolId] = exp;
      });
    }

    const finalExplanations = schools.map(school => {
      if (explanationMap[school.id]) {
        return explanationMap[school.id];
      }
      // Fallback for any missing schools
      return {
        schoolId: school.id,
        matches: [
          { type: "positive", text: "Offers quality education" },
          { type: "positive", text: "Meets grade requirements" },
          { type: "tradeoff", text: "Consider visiting for full picture" }
        ]
      };
    });

    return Response.json({ explanations: finalExplanations });
  } catch (error) {
    console.error('Error generating match explanations:', error);
    return Response.json({ 
      error: error.message,
      explanations: []
    }, { status: 500 });
  }
});
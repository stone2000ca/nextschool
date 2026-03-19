import { School } from '@/lib/entities-server'
import { invokeLLM } from '@/lib/integrations'

export async function generateSchoolSummary(params: { schoolId: string }) {
  const { schoolId } = params;

  const schools = await School.filter({ id: schoolId });
  if (!schools || schools.length === 0) {
    throw Object.assign(new Error('School not found'), { statusCode: 404 });
  }

  const school = schools[0] as any;

  const summaryPrompt = `Create a 2-3 sentence compelling summary for this school:

${school.name}
Location: ${school.city}, ${school.province_state}, ${school.region}
Grades: ${school.grades_served}
Curriculum: ${school.curriculum}
Specializations: ${school.specializations?.join(', ')}
Mission: ${school.mission_statement}
Programs: ${school.arts_programs?.length || 0} arts, ${school.sports_programs?.length || 0} sports, ${school.clubs?.length || 0} clubs

Write in a warm, informative tone highlighting what makes this school unique.`;

  const result = await invokeLLM({
    prompt: summaryPrompt,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" }
      }
    }
  });

  return { summary: result.summary };
}

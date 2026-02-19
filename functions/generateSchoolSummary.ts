import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { schoolId } = await req.json();

    const schools = await base44.entities.School.filter({ id: schoolId });
    if (!schools || schools.length === 0) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const school = schools[0];

    const summaryPrompt = `Create a 2-3 sentence compelling summary for this school:

${school.name}
Location: ${school.city}, ${school.provinceState}, ${school.region}
Grades: ${school.gradesServed}
Curriculum: ${school.curriculumType}
Specializations: ${school.specializations?.join(', ')}
Mission: ${school.missionStatement}
Programs: ${school.artsPrograms?.length || 0} arts, ${school.sportsPrograms?.length || 0} sports, ${school.clubs?.length || 0} clubs

Write in a warm, informative tone highlighting what makes this school unique.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: summaryPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" }
        }
      }
    });

    return Response.json({ summary: result.summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
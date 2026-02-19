import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message, conversationHistory, conversationContext, region, userId } = await req.json();

    const context = conversationContext || {};
    const history = conversationHistory || [];
    
    // Get last 10 messages for context
    const recentMessages = history.slice(-10);
    const conversationSummary = recentMessages
      .map(msg => `${msg.role === 'user' ? 'Parent' : 'Consultant'}: ${msg.content}`)
      .join('\n');

    // First pass: Determine intent and extract filter criteria
    const intentPrompt = `You are analyzing a parent's message to determine their intent and extract school search criteria.

CONVERSATION CONTEXT:
${conversationSummary || 'First message in conversation.'}

CURRENT STATE:
- Child grade: ${context.childGrade || 'unknown'}
- Location: ${context.location || 'not specified'}
- Region: ${context.region || region || 'not specified'}

DECISION LOGIC:
- If message contains grade AND (city/region) → shouldShowSchools: true
- If message contains "show", "find", "see schools", "list" → shouldShowSchools: true  
- If asking about specific school details → intent: VIEW_DETAIL, shouldShowSchools: false
- If asking to compare schools → intent: COMPARE_SCHOOLS
- If only greeting with no info → shouldShowSchools: false

INTENT OPTIONS:
- SHOW_SCHOOLS: Show matching schools (search/filter request)
- NARROW_DOWN: Refine existing criteria
- COMPARE_SCHOOLS: Compare specific schools
- VIEW_DETAIL: Details on one school
- ASK_QUESTION: General question about shown schools
- NO_ACTION: Just greeting

Parent's message: "${message}"

Return JSON with intent, shouldShowSchools (boolean), and filterCriteria (if applicable).`;

    const intentResponse = await base44.integrations.Core.InvokeLLM({
      prompt: intentPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          intent: { type: "string" },
          shouldShowSchools: { type: "boolean" },
          filterCriteria: {
            type: "object",
            properties: {
              city: { type: "string" },
              region: { type: "string" },
              grade: { type: "number" },
              minTuition: { type: "number" },
              maxTuition: { type: "number" },
              specializations: { type: "array", items: { type: "string" } }
            }
          },
          schoolIds: { type: "array", items: { type: "string" } }
        },
        required: ["intent", "shouldShowSchools"]
      }
    });

    // Fetch matching schools if needed
    let matchingSchools = [];
    if (intentResponse.shouldShowSchools && intentResponse.filterCriteria) {
      const filters = {};
      if (intentResponse.filterCriteria.city) filters.city = intentResponse.filterCriteria.city;
      if (intentResponse.filterCriteria.region) filters.region = intentResponse.filterCriteria.region;
      
      let schools = await base44.asServiceRole.entities.School.filter(filters);
      
      // Apply grade filter
      if (intentResponse.filterCriteria.grade) {
        schools = schools.filter(s => 
          s.lowestGrade <= intentResponse.filterCriteria.grade && 
          s.highestGrade >= intentResponse.filterCriteria.grade
        );
      }
      
      // Apply tuition filter
      if (intentResponse.filterCriteria.minTuition || intentResponse.filterCriteria.maxTuition) {
        schools = schools.filter(s => {
          if (!s.tuition) return false;
          if (intentResponse.filterCriteria.minTuition && s.tuition < intentResponse.filterCriteria.minTuition) return false;
          if (intentResponse.filterCriteria.maxTuition && s.tuition > intentResponse.filterCriteria.maxTuition) return false;
          return true;
        });
      }
      
      // Apply specializations filter
      if (intentResponse.filterCriteria.specializations?.length > 0) {
        schools = schools.filter(s =>
          s.specializations && 
          intentResponse.filterCriteria.specializations.some(spec => s.specializations.includes(spec))
        );
      }
      
      // Fallback: if no results, show all in region
      if (schools.length === 0 && intentResponse.filterCriteria.region) {
        schools = await base44.asServiceRole.entities.School.filter({ 
          region: intentResponse.filterCriteria.region 
        });
      }
      
      matchingSchools = schools.slice(0, 10); // Limit to 10 results
    }

    // Build school context for AI
    const schoolContext = matchingSchools.length > 0 
      ? `\n\nMATCHING SCHOOLS FROM DATABASE (${matchingSchools.length} found):\n` + 
        matchingSchools.map(s => 
          `- ${s.name} (${s.city}, ${s.region}) | Grades ${s.lowestGrade}-${s.highestGrade} | ${s.tuition ? s.currency + ' ' + s.tuition : 'N/A'} | Specializations: ${s.specializations?.join(', ') || 'N/A'}`
        ).join('\n')
      : '';

    // Second pass: Generate response with school context
    const responsePrompt = `You are an experienced education consultant helping parents find the right private school.

CRITICAL RULES:
1. BE CONCISE: Maximum 2-3 sentences. Lead with value (school names, specific recommendations).
2. ONLY REFERENCE SCHOOLS FROM DATABASE RESULTS: Never invent school names. Only mention schools listed below.
3. INCLUDE ACCURATE DETAILS: When mentioning a school, use its correct city and details from the database.
4. VARY YOUR OPENINGS: Don't start every response with "It's great to hear..."

CONVERSATION CONTEXT:
${conversationSummary || 'First message in conversation.'}

INTENT DETECTED: ${intentResponse.intent}
${schoolContext}

Parent's message: "${message}"

Generate a natural, helpful response (2-3 sentences max). Reference specific schools from the database results if available.`;

    const finalResponse = await base44.integrations.Core.InvokeLLM({
      prompt: responsePrompt
    });

    return Response.json({
      message: finalResponse,
      intent: intentResponse.intent,
      command: {
        action: intentResponse.intent === 'COMPARE_SCHOOLS' ? 'compare' : 
                intentResponse.intent === 'VIEW_DETAIL' ? 'view_detail' : 
                intentResponse.shouldShowSchools ? 'search_schools' : null,
        params: intentResponse.filterCriteria || intentResponse.schoolIds || {},
        reasoning: `Intent: ${intentResponse.intent}`
      },
      shouldShowSchools: intentResponse.shouldShowSchools,
      filterCriteria: intentResponse.filterCriteria || null,
      matchingSchools: matchingSchools.map(s => s.id)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
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

    // Build AI prompt with directive to show schools quickly
    const systemPrompt = `You are an experienced education consultant helping parents find the right private school for their child across Canada, the US, and Europe.

CRITICAL RULES:
1. BE CONCISE: Maximum 2-3 sentences. Lead with value (school names, specific recommendations), not pleasantries.
2. SHOW SCHOOLS FAST: If parent provides grade AND location OR explicitly asks to see schools, IMMEDIATELY set shouldShowSchools=true. Don't ask for more info first.
3. REFERENCE SCHOOLS SHOWN: After showing results, mention specific school names in your response (e.g., "Here are 3 schools near Toronto. St. George's has a strong STEM program.")
4. MAX 1 QUESTION BEFORE RESULTS: Never ask 2+ clarifying questions without showing schools.
5. VARY YOUR OPENINGS: Don't start every response with "It's great to hear..." Mix it up.

CONVERSATION CONTEXT:
${conversationSummary || 'First message in conversation.'}

CURRENT STATE:
- Child grade: ${context.childGrade || 'unknown'}
- Location: ${context.location || 'not specified'}
- Region: ${context.region || region || 'not specified'}
- Priorities: ${context.priorities?.join(', ') || 'none'}
- Schools viewed: ${context.viewedSchools?.length || 0}

DECISION LOGIC:
- If message contains grade AND (city/region) → shouldShowSchools: true
- If message contains "show", "find", "see schools", "list" → shouldShowSchools: true  
- If only greeting with no info → ask 1 clarifying question, shouldShowSchools: false
- After showing schools once → ask follow-ups WHILE keeping schools visible

INTENT OPTIONS:
- SHOW_SCHOOLS: Show matching schools
- COMPARE_SCHOOLS: Compare specific schools
- VIEW_DETAIL: Details on one school
- UPDATE_PREFERENCES: Stating new criteria
- ASK_QUESTION: General question
- NO_ACTION: Just greeting

RESPONSE FORMAT (JSON):
{
  "message": "Your 2-3 sentence response, referencing schools if showing them",
  "intent": "SHOW_SCHOOLS|etc",
  "command": {
    "action": "search_schools|compare|view_detail|null",
    "params": {filters},
    "reasoning": "Why this action"
  },
  "shouldShowSchools": true/false,
  "filterCriteria": {
    "city": "extracted city if mentioned",
    "region": "Canada|US|Europe if mentioned",
    "grade": number if mentioned,
    "minTuition": number if budget mentioned,
    "maxTuition": number if budget mentioned,
    "specializations": ["STEM", "Arts", etc] if interests mentioned
  }
}

Parent's message: "${message}"

Respond with JSON only.`;

    // Call AI for intent classification and response generation
    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: systemPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          intent: { type: "string" },
          command: {
            type: "object",
            properties: {
              action: { type: "string" },
              params: { type: "object" },
              reasoning: { type: "string" }
            }
          },
          shouldShowSchools: { type: "boolean" },
          filterCriteria: { type: "object" }
        },
        required: ["message", "intent"]
      }
    });

    // If intent is SHOW_SCHOOLS, call searchSchools to get actual results
    let schoolIds = [];
    if (aiResponse.shouldShowSchools && aiResponse.filterCriteria) {
      try {
        const searchResult = await base44.functions.invoke('searchSchools', {
          ...aiResponse.filterCriteria,
          region: aiResponse.filterCriteria.region || region
        });
        
        if (searchResult.data?.schools) {
          schoolIds = searchResult.data.schools.map(s => s.id);
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
    }

    return Response.json({
      message: aiResponse.message,
      intent: aiResponse.intent,
      command: aiResponse.command,
      schoolIds,
      shouldShowSchools: aiResponse.shouldShowSchools || false,
      filterCriteria: aiResponse.filterCriteria || null
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
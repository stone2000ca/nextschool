import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message, conversationId, region } = await req.json();

    // Get conversation context
    const conversation = conversationId ? 
      await base44.entities.ChatHistory.filter({ id: conversationId })[0] : 
      null;

    const context = conversation?.conversationContext || {};
    const shortTermContext = conversation?.shortTermContext || [];
    const longTermSummary = conversation?.longTermSummary || '';

    // Build AI prompt
    const systemPrompt = `You are an experienced education consultant helping parents find the right private school for their child across ${region || 'multiple regions'}. 

Your approach:
- Use Socratic questioning to understand needs deeply
- Be warm, empathetic, and non-pushy
- Guide parents through priorities: academics, values, budget, location, programs
- Ask clarifying questions before recommending
- Acknowledge tradeoffs and help prioritize

Context from conversation:
${longTermSummary || 'New conversation - learn about their needs first'}

Recent context:
${shortTermContext.join('\n') || 'Just starting'}

Current state:
- Child grade: ${context.childGrade || 'unknown'}
- Location: ${context.location || 'unknown'}
- Region preference: ${context.region || region || 'unspecified'}
- Priorities: ${context.priorities?.join(', ') || 'none identified yet'}
- Schools viewed: ${context.viewedSchools?.length || 0}
- Shortlisted: ${context.shortlist?.length || 0}

Analyze their message and decide on an intent:
- SHOW_SCHOOLS: They want to see matching schools (return school filters)
- NARROW_DOWN: They're refining criteria (ask clarifying questions)
- COMPARE_SCHOOLS: They want to compare specific schools
- VIEW_DETAIL: They want details on a specific school
- UPDATE_PREFERENCES: They're stating preferences
- ASK_QUESTION: General question about schools/process
- MANAGE_SHORTLIST: Add/remove from shortlist
- NO_ACTION: Just chatting

Respond with JSON:
{
  "message": "Your warm, consultant-style response",
  "intent": "SHOW_SCHOOLS|NARROW_DOWN|etc",
  "command": {
    "action": "search_schools|compare|view_detail|etc",
    "params": {"filters or IDs"},
    "reasoning": "Why this action"
  }
}`;

    const userMessage = `User: ${message}`;

    // Call AI
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\n${userMessage}`,
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
          }
        }
      }
    });

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
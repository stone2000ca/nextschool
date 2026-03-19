import { ChatHistory } from '@/lib/entities-server'
import { invokeLLM } from '@/lib/integrations'

export async function summarizeConversation(params: {
  conversationId: string
  userId: string
}) {
  const { conversationId, userId } = params;

  if (!userId) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }

  // Get conversation
  const conversations = await ChatHistory.filter({ id: conversationId });
  if (!conversations || conversations.length === 0) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }

  if ((conversations[0] as any)?.user_id !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const conversation = conversations[0] as any;
  const messages = conversation.messages || [];

  // Build conversation text
  const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');

  // Generate summary with AI
  const summaryPrompt = `Analyze this school search conversation and extract:

1. Long-term summary: Key facts about their search (child details, must-haves, deal-breakers, budget, location)
2. Short-term context: Last 8 key points from recent messages (what they just discussed/decided)
3. Preferences: Extract specific criteria
4. Behavioral patterns: What they click on, hesitate about, prioritize

Conversation:
${conversationText}

Return JSON with:
{
  "longTermSummary": "concise summary of overall search",
  "shortTermContext": ["point 1", "point 2", ...up to 8],
  "extractedPreferences": {
    "childGrade": number or null,
    "location": "string or null",
    "priorities": ["array"],
    "region": "Canada|US|Europe or null"
  }
}`;

  const summary = await invokeLLM({
    prompt: summaryPrompt,
    response_json_schema: {
      type: "object",
      properties: {
        longTermSummary: { type: "string" },
        shortTermContext: {
          type: "array",
          items: { type: "string" }
        },
        extractedPreferences: {
          type: "object",
          properties: {
            childGrade: { type: ["number", "null"] },
            location: { type: ["string", "null"] },
            priorities: {
              type: "array",
              items: { type: "string" }
            },
            region: { type: ["string", "null"] }
          }
        }
      }
    }
  });

  // Update conversation
  await ChatHistory.update(conversationId, {
    long_term_summary: summary.longTermSummary,
    short_term_context: summary.shortTermContext,
    conversation_context: {
      ...conversation.conversation_context,
      ...summary.extractedPreferences
    }
  });

  return summary;
}

import { ChatHistory } from '@/lib/entities-server'
import { invokeLLM } from '@/lib/integrations'

export async function generateConversationTitle(params: { conversationId: string }) {
  const { conversationId } = params;

  // Get conversation
  const conversation = await ChatHistory.filter({ id: conversationId });
  if (!conversation || conversation.length === 0) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }

  const messages = conversation[0].messages || [];
  if (messages.length < 2) {
    return { title: 'New Conversation' };
  }

  // Get first few messages
  const firstMessages = messages.slice(0, 4).map((m: any) => `${m.role}: ${m.content}`).join('\n');

  // Generate title
  const titlePrompt = `Based on this conversation, generate a concise, descriptive title (max 50 characters).
Examples: "Toronto Private Schools for Grade 5", "Affordable Boarding Schools in Europe", "STEM-focused Schools in Vancouver"

Conversation:
${firstMessages}

Return only the title, nothing else.`;

  const title = await invokeLLM({
    prompt: titlePrompt
  });

  // Update conversation title
  await ChatHistory.update(conversationId, {
    title: String(title).trim()
  });

  return { title: String(title).trim() };
}

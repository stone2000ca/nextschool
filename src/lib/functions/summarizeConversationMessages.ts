import { ChatHistory, ConversationSummary } from '@/lib/entities-server'
import { invokeLLM } from '@/lib/integrations'

export async function summarizeConversationMessages(params: {
  conversationId: string
  userId: string
}) {
  const { conversationId, userId } = params;

  if (!userId) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }

  // Get conversation
  const conversation = await ChatHistory.filter({ id: conversationId });
  if (!conversation || conversation.length === 0) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }

  if ((conversation[0] as any)?.userId !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const conv = conversation[0] as any;
  const messages = conv.messages || [];

  // Only summarize if more than 5 messages
  if (messages.length <= 5) {
    return { summary: null, message: 'Not enough messages to summarize' };
  }

  // Keep the last 5 messages, summarize the rest
  const recentMessages = messages.slice(-5);
  const oldMessages = messages.slice(0, -5);

  // Check if summary already exists
  const existingSummary = await ConversationSummary.filter({
    conversationId
  });

  // Create summary of old messages
  const messagesToSummarize = oldMessages
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n');

  const summaryPrompt = `Summarize this conversation concisely (max 300 words). Focus on key details: child's grade, location preferences, school criteria, and schools discussed.

Conversation:
${messagesToSummarize}

Return a concise summary.`;

  const summary = await invokeLLM({
    prompt: summaryPrompt
  });

  // Save or update summary
  if (existingSummary && existingSummary.length > 0) {
    await ConversationSummary.update(existingSummary[0].id, {
      summary: String(summary).trim(),
      messageCount: oldMessages.length,
      lastSummarizedAt: new Date().toISOString()
    });
  } else {
    await ConversationSummary.create({
      userId: conv.userId,
      conversationId,
      summary: String(summary).trim(),
      messageCount: oldMessages.length,
      lastSummarizedAt: new Date().toISOString()
    });
  }

  // Archive old messages before truncating
  const existingArchive = conv.archivedMessages || [];
  const archivedMessages = [...existingArchive, ...oldMessages];
  if (archivedMessages.length > 500) archivedMessages.splice(0, archivedMessages.length - 500);

  // Update conversation to only keep recent messages + reference to summary
  await ChatHistory.update(conversationId, {
    messages: recentMessages,
    longTermSummary: String(summary).trim(),
    archivedMessages
  });

  return {
    success: true,
    summary: String(summary).trim(),
    messagesKept: recentMessages.length,
    messagesSummarized: oldMessages.length
  };
}

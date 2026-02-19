import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { conversationId } = await req.json();

    // Get conversation
    const conversation = await base44.asServiceRole.entities.ChatHistory.filter({ id: conversationId });
    if (!conversation || conversation.length === 0) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = conversation[0].messages || [];
    if (messages.length < 2) {
      return Response.json({ title: 'New Conversation' });
    }

    // Get first few messages
    const firstMessages = messages.slice(0, 4).map(m => `${m.role}: ${m.content}`).join('\n');

    // Generate title
    const titlePrompt = `Based on this conversation, generate a concise, descriptive title (max 50 characters).
Examples: "Toronto Private Schools for Grade 5", "Affordable Boarding Schools in Europe", "STEM-focused Schools in Vancouver"

Conversation:
${firstMessages}

Return only the title, nothing else.`;

    const title = await base44.integrations.Core.InvokeLLM({
      prompt: titlePrompt
    });

    // Update conversation title
    await base44.asServiceRole.entities.ChatHistory.update(conversationId, {
      title: title.trim()
    });

    return Response.json({ title: title.trim() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
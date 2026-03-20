import { fetchUserMemory, createUserMemory, updateUserMemory } from '@/lib/api/entities-api';
import { invokeFunction } from '@/lib/functions';

// Memory Manager — Extract & deduplicate LLM facts
export async function extractAndSaveMemories(messageText, responseMessage, user, _unused) {
  if (!user) return;

  try {
    const memoryPrompt = `Extract ONLY verified facts that the user explicitly stated about themselves or their family. 
DO NOT infer from schools shown, locations searched, or school details.
DO NOT store negative statements like "not mentioned" or "unknown".
Return a JSON array of facts ONLY if user said them directly.

User message: "${messageText}"
AI response: "${responseMessage}"

Facts to extract (only if user said them):
- Child's name, age, grade level
- Parent/family location/address  
- Budget they mentioned
- School preferences they stated
- Academic/non-academic priorities they mentioned

Return empty array if user didn't provide any of these facts.`;

    const memoryResult = await invokeFunction('invokeLLM', {
      prompt: memoryPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          facts: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    // Only update if we got new facts
    if (memoryResult.facts && memoryResult.facts.length > 0) {
      const existingMemories = await fetchUserMemory({ user_id: user.id });
      if (existingMemories.length > 0) {
        const existingMem = existingMemories[0];
        // Use Set to deduplicate, then convert back to array
        const dedupedMemories = [...new Set([...existingMem.memories, ...memoryResult.facts])];
        await updateUserMemory(existingMem.id, {
          memories: dedupedMemories,
          last_updated: new Date().toISOString()
        });
      } else {
        await createUserMemory({
          user_id: user.id,
          memories: memoryResult.facts,
          last_updated: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    console.error('Failed to save memories:', e);
  }
}
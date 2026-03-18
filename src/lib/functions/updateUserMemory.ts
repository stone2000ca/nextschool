import { UserMemory } from '@/lib/entities-server'

const MAX_MEMORIES = 25;

function detectCategory(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('prefer') || lower.includes('want') || lower.includes('looking for') || lower.includes('important')) return 'preference';
  if (lower.includes('child') || lower.includes('grade') || lower.includes('age') || lower.includes('budget') || lower.includes('location')) return 'fact';
  if (lower.includes('feedback') || lower.includes('liked') || lower.includes('disliked') || lower.includes('concern')) return 'feedback';
  return 'context';
}

export async function updateUserMemory(params: {
  memories: string[]
  userId: string
}) {
  const { memories, userId } = params;

  if (!userId) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  if (!memories || !Array.isArray(memories)) {
    throw Object.assign(new Error('Invalid memories array'), { statusCode: 400 });
  }

  // Fetch all existing memory records for this user
  const existingRecords = await UserMemory.filter({ userId });

  // AC6: Backward compat — normalize legacy records missing category
  for (const mem of existingRecords) {
    if (!(mem as any).category) {
      try {
        await UserMemory.update(mem.id, {
          category: 'context',
          confidence: 0.5,
          source: 'legacy',
          lastAccessed: (mem as any).lastAccessed || new Date().toISOString()
        });
      } catch(e) {}
    }
  }

  // Enforce max cap — if at limit, skip creating new ones
  const currentCount = existingRecords.length;
  let created = 0;
  let updated = 0;

  const now = new Date().toISOString();

  for (const content of memories) {
    if (typeof content !== 'string' || !content.trim()) continue;

    // Check for duplicate by content
    const duplicate = existingRecords.find((m: any) => m.content === content);

    if (duplicate) {
      // Update lastAccessed only
      await UserMemory.update(duplicate.id, { lastAccessed: now });
      updated++;
    } else {
      // Enforce max cap
      if (currentCount + created >= MAX_MEMORIES) continue;

      await UserMemory.create({
        userId,
        content,
        category: detectCategory(content),
        confidence: 0.8,
        lastAccessed: now,
        source: 'extraction'
      });
      created++;
    }
  }

  return { success: true, created, updated };
}

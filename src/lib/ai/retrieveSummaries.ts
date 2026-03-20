/**
 * Retrieve conversation summaries for prompt context assembly.
 *
 * Two retrieval modes:
 * 1. getLatestSummaries — chronological, returns latest N summary chunks
 * 2. getRelevantSummaries — semantic search, returns most relevant summaries
 *    for a given query text
 *
 * Both return empty arrays on failure (never throw).
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { searchConversationSummaries } from './semanticSearch'

export interface StoredSummary {
  id: string
  conversationId: string
  summary: string
  messageCount: number
  lastSummarizedAt: string
  createdAt: string
  similarity?: number
}

/**
 * Get the latest N summaries for a conversation, ordered by creation time (newest first).
 */
export async function getLatestSummaries(
  conversationId: string,
  count: number = 5
): Promise<StoredSummary[]> {
  if (!conversationId) return []

  try {
    const client = getAdminClient()
    const { data, error } = await client
      .from('conversation_summaries')
      .select('id, conversation_id, summary, message_count, last_summarized_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(count)

    if (error) {
      console.error('[retrieveSummaries] getLatestSummaries error:', error.message)
      return []
    }

    return (data || []).map(mapRow)
  } catch (err: any) {
    console.error('[retrieveSummaries] getLatestSummaries failed:', err?.message || err)
    return []
  }
}

/**
 * Semantic search across conversation summaries.
 * Returns summaries most relevant to the given query text,
 * scoped to a specific conversation.
 */
export async function getRelevantSummaries(
  conversationId: string,
  queryText: string,
  limit: number = 5
): Promise<StoredSummary[]> {
  if (!conversationId || !queryText?.trim()) return []

  try {
    const results = await searchConversationSummaries(queryText, conversationId, limit)

    return results.map(row => ({
      id: row.id,
      conversationId: row.conversation_id || conversationId,
      summary: row.summary || '',
      messageCount: row.message_count || 0,
      lastSummarizedAt: row.last_summarized_at || '',
      createdAt: row.created_at || '',
      similarity: row.similarity,
    }))
  } catch (err: any) {
    console.error('[retrieveSummaries] getRelevantSummaries failed:', err?.message || err)
    return []
  }
}

/**
 * Build a combined context string from summaries for prompt injection.
 * Returns an empty string if no summaries are available.
 */
export function buildSummaryContext(summaries: StoredSummary[]): string {
  if (!summaries || summaries.length === 0) return ''

  return summaries
    .map((s, i) => `[Summary ${i + 1} (${s.messageCount} messages)]: ${s.summary}`)
    .join('\n\n')
}

// ─── Internal helpers ───────────────────────────────────────────────

function mapRow(row: any): StoredSummary {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    summary: row.summary || '',
    messageCount: row.message_count || 0,
    lastSummarizedAt: row.last_summarized_at || '',
    createdAt: row.created_at || '',
  }
}

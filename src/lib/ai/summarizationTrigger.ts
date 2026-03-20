/**
 * Summarization Trigger
 *
 * Checks whether a conversation has hit a summarization threshold (every 10th message),
 * generates a summary, embeds it, and stores it in conversation_summaries.
 *
 * Designed to be called after each message is added to a conversation.
 * Completely fire-and-forget safe — never throws, never crashes the caller.
 */

import { ConversationMessage, summarizeMessages } from './conversationSummarizer'
import { generateEmbedding } from './generateEmbedding'
import { ConversationSummary } from '@/lib/entities-server'
import { getAdminClient } from '@/lib/supabase/admin'

const SUMMARIZATION_INTERVAL = 10

export interface SummarizationTriggerParams {
  conversationId: string
  userId: string
  messages: ConversationMessage[]
}

export interface SummarizationTriggerResult {
  triggered: boolean
  summaryId?: string
  error?: string
}

/**
 * Check if summarization should run and execute it if so.
 * Returns a result indicating whether summarization was triggered.
 *
 * Rules:
 * - Fewer than 10 messages → skip (no summary needed)
 * - Message count is not a multiple of SUMMARIZATION_INTERVAL → skip
 * - On LLM failure → returns gracefully with error info, no crash
 */
export async function checkAndSummarize(
  params: SummarizationTriggerParams
): Promise<SummarizationTriggerResult> {
  const { conversationId, userId, messages } = params

  try {
    // Only trigger on every 10th message
    if (!messages || messages.length < SUMMARIZATION_INTERVAL) {
      return { triggered: false }
    }

    if (messages.length % SUMMARIZATION_INTERVAL !== 0) {
      return { triggered: false }
    }

    // Generate summary from all messages so far
    const summaryResult = await summarizeMessages(messages)

    if (!summaryResult) {
      console.warn(`[summarizationTrigger] Summary generation failed for conversation ${conversationId}, falling back to raw messages`)
      return { triggered: true, error: 'Summary generation failed' }
    }

    // Build the full summary text for storage and embedding
    const summaryText = summaryResult.summary

    // Generate embedding for the summary
    const embedding = await generateEmbedding(summaryText)
    const vectorLiteral = embedding ? `[${embedding.join(',')}]` : null

    // Store to conversation_summaries
    const record = await ConversationSummary.create({
      user_id: userId,
      conversation_id: conversationId,
      summary: summaryText,
      message_count: messages.length,
      last_summarized_at: new Date().toISOString(),
    })

    // Update embedding via direct update (vector column needs special handling)
    if (vectorLiteral && record?.id) {
      const client = getAdminClient()
      await (client.from('conversation_summaries') as any)
        .update({ embedding: vectorLiteral })
        .eq('id', record.id)
    }

    return { triggered: true, summaryId: record?.id }
  } catch (err: any) {
    console.error(`[summarizationTrigger] Error for conversation ${conversationId}:`, err?.message || err)
    return { triggered: true, error: err?.message || 'Unknown error' }
  }
}

/**
 * Force-summarize a conversation regardless of message count thresholds.
 * Useful for on-demand summarization (e.g., when user requests it).
 * Still requires at least 1 message. Returns null on failure.
 */
export async function forceSummarize(
  params: SummarizationTriggerParams
): Promise<SummarizationTriggerResult> {
  const { conversationId, userId, messages } = params

  try {
    if (!messages || messages.length === 0) {
      return { triggered: false }
    }

    const summaryResult = await summarizeMessages(messages)

    if (!summaryResult) {
      return { triggered: true, error: 'Summary generation failed' }
    }

    const summaryText = summaryResult.summary
    const embedding = await generateEmbedding(summaryText)
    const vectorLiteral = embedding ? `[${embedding.join(',')}]` : null

    const record = await ConversationSummary.create({
      user_id: userId,
      conversation_id: conversationId,
      summary: summaryText,
      message_count: messages.length,
      last_summarized_at: new Date().toISOString(),
    })

    if (vectorLiteral && record?.id) {
      const client = getAdminClient()
      await (client.from('conversation_summaries') as any)
        .update({ embedding: vectorLiteral })
        .eq('id', record.id)
    }

    return { triggered: true, summaryId: record?.id }
  } catch (err: any) {
    console.error(`[summarizationTrigger] Force summarize error:`, err?.message || err)
    return { triggered: true, error: err?.message || 'Unknown error' }
  }
}

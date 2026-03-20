/**
 * Conversation Summarization Engine
 *
 * Takes an array of chat messages and produces a structured 3-5 sentence
 * summary extracting: schools discussed, decisions made, concerns raised,
 * preferences clarified, and questions asked.
 *
 * Uses OpenRouter LLM via invokeLLM. Returns null on failure (never throws).
 */

import { invokeLLM } from '@/lib/integrations'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ConversationSummaryResult {
  summary: string
  schoolsDiscussed: string[]
  decisionsMade: string[]
  concernsRaised: string[]
  preferenceClarified: string[]
  questionsAsked: string[]
}

// Approximate token count: ~4 chars per token for English text
const MAX_SUMMARY_TOKENS = 500
const APPROX_CHARS_PER_TOKEN = 4
const MAX_SUMMARY_CHARS = MAX_SUMMARY_TOKENS * APPROX_CHARS_PER_TOKEN

const SUMMARIZATION_PROMPT = `You are a conversation summarizer for a school search platform. Analyze the following conversation messages and produce a concise summary.

Your summary MUST:
- Be 3-5 sentences long
- Extract key information about: schools discussed, decisions made, concerns raised, preferences clarified, and questions the user asked
- Focus on actionable information that would help continue the conversation later
- Be written in third person (e.g., "The family is looking for...")

Conversation:
{MESSAGES}

Return JSON with this exact structure:
{
  "summary": "3-5 sentence summary of the conversation so far",
  "schoolsDiscussed": ["school names mentioned or discussed"],
  "decisionsMade": ["any decisions or conclusions reached"],
  "concernsRaised": ["worries, hesitations, or deal-breakers mentioned"],
  "preferenceClarified": ["preferences or criteria that became clear"],
  "questionsAsked": ["key questions the user asked that may need follow-up"]
}`

/**
 * Summarize a set of conversation messages.
 * Returns null if messages are empty or if the LLM call fails.
 */
export async function summarizeMessages(
  messages: ConversationMessage[]
): Promise<ConversationSummaryResult | null> {
  if (!messages || messages.length === 0) {
    return null
  }

  // Build conversation text from messages
  const conversationText = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'Parent' : 'Consultant'}: ${m.content}`)
    .join('\n')

  if (!conversationText.trim()) {
    return null
  }

  const prompt = SUMMARIZATION_PROMPT.replace('{MESSAGES}', conversationText)

  try {
    const result = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          schoolsDiscussed: { type: 'array', items: { type: 'string' } },
          decisionsMade: { type: 'array', items: { type: 'string' } },
          concernsRaised: { type: 'array', items: { type: 'string' } },
          preferenceClarified: { type: 'array', items: { type: 'string' } },
          questionsAsked: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary', 'schoolsDiscussed', 'decisionsMade', 'concernsRaised', 'preferenceClarified', 'questionsAsked'],
      },
    })

    if (!result || typeof result.summary !== 'string') {
      console.error('[conversationSummarizer] Unexpected LLM response shape')
      return null
    }

    // Truncate summary at sentence boundary if too long
    const truncatedSummary = truncateAtSentenceBoundary(result.summary, MAX_SUMMARY_CHARS)

    return {
      summary: truncatedSummary,
      schoolsDiscussed: result.schoolsDiscussed || [],
      decisionsMade: result.decisionsMade || [],
      concernsRaised: result.concernsRaised || [],
      preferenceClarified: result.preferenceClarified || [],
      questionsAsked: result.questionsAsked || [],
    }
  } catch (err: any) {
    console.error('[conversationSummarizer] LLM call failed:', err?.message || err)
    return null
  }
}

/**
 * Truncate text at the nearest sentence boundary without exceeding maxChars.
 * If no sentence boundary is found, truncates at the last word boundary.
 */
export function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  // Find the last sentence-ending punctuation within maxChars
  const truncated = text.slice(0, maxChars)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  )

  if (lastSentenceEnd > 0) {
    // Include the punctuation character
    return truncated.slice(0, lastSentenceEnd + 1).trim()
  }

  // Check if text ends with sentence punctuation right at the boundary
  if (truncated.endsWith('.') || truncated.endsWith('!') || truncated.endsWith('?')) {
    return truncated.trim()
  }

  // Fallback: find last period anywhere
  const lastPeriod = truncated.lastIndexOf('.')
  if (lastPeriod > maxChars * 0.5) {
    return truncated.slice(0, lastPeriod + 1).trim()
  }

  // Last resort: truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace).trim() + '...'
  }

  return truncated.trim() + '...'
}

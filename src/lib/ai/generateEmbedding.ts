/**
 * Generate embeddings via OpenAI text-embedding-3-small
 * - Exponential backoff (max 3 retries)
 * - In-session cache (Map keyed by input text)
 * - Returns null on failure, never throws
 * - Empty/whitespace input returns null immediately
 */

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// In-session cache: text → embedding vector
const embeddingCache = new Map<string, number[]>()

/**
 * Generate a 1536-dimensional embedding for the given text.
 * Returns null if the input is empty or if the API call fails after retries.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  // Guard: empty or whitespace-only input
  if (!text || !text.trim()) {
    return null
  }

  const trimmed = text.trim()

  // Check cache
  if (embeddingCache.has(trimmed)) {
    return embeddingCache.get(trimmed)!
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[generateEmbedding] OPENAI_API_KEY is not set')
    return null
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENAI_EMBEDDING_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: trimmed,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[generateEmbedding] API error (attempt ${attempt + 1}/${MAX_RETRIES}): ${response.status} ${errText}`)

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return null
        }

        // Exponential backoff before retry
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        }
        continue
      }

      const data = await response.json()
      const embedding: number[] = data?.data?.[0]?.embedding

      if (!embedding || !Array.isArray(embedding)) {
        console.error('[generateEmbedding] Unexpected response shape')
        return null
      }

      // Cache the result
      embeddingCache.set(trimmed, embedding)

      return embedding
    } catch (err: any) {
      console.error(`[generateEmbedding] Network error (attempt ${attempt + 1}/${MAX_RETRIES}):`, err?.message || err)

      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
      }
    }
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

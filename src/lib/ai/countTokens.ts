/**
 * Token counting and budget enforcement for prompt context assembly.
 *
 * Uses gpt-tokenizer (cl100k_base encoding, same as GPT-4 / GPT-4o)
 * to estimate token counts. Provides a budget guard that trims
 * context layers in priority order when over the hard cap.
 *
 * Part of E52-A3: Context Assembler & Token Budget Manager.
 */

import { encode } from 'gpt-tokenizer'

// ─── Budget constants ────────────────────────────────────────────────

/** Soft target — aim to stay under this. */
export const TOKEN_TARGET = 2500

/** Hard cap — never exceed this. */
export const TOKEN_HARD_CAP = 4000

/** Per-layer budgets (soft targets, not hard limits). */
export const LAYER_BUDGETS = {
  static: 600,   // Layer 1: system instructions, family brief, session state
  active: 1550,  // Layer 2: rolling summaries, recent messages, school artifacts
  retrieved: 700, // Layer 3: on-demand comparison / semantic context
} as const

// ─── Core counting ───────────────────────────────────────────────────

/**
 * Count tokens in a string using cl100k_base encoding.
 * Returns 0 for empty/null input.
 */
export function countTokens(text: string | null | undefined): number {
  if (!text) return 0
  try {
    return encode(text).length
  } catch {
    // Fallback: rough estimate (~4 chars per token for English)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Count total tokens across multiple strings.
 */
export function countTokensMulti(texts: (string | null | undefined)[]): number {
  return texts.reduce((sum, t) => sum + countTokens(t), 0)
}

// ─── Budget enforcement ──────────────────────────────────────────────

export interface ContextLayers {
  /** Layer 1: system instructions + family brief + session state */
  static: string
  /** Layer 2: rolling summaries + recent messages + school artifacts */
  active: string
  /** Layer 3: on-demand comparison / semantic context */
  retrieved: string
}

export interface BudgetResult {
  layers: ContextLayers
  totalTokens: number
  trimmed: boolean
  trimActions: string[]
}

/**
 * Enforce the token budget on assembled context layers.
 *
 * Trim priority (from least to most important):
 * 1. Drop Layer 3 (retrieved context) entirely
 * 2. Compress school artifact in Layer 2 (truncate to first 200 chars)
 * 3. Reduce rolling window from 6 to 4 messages in Layer 2
 * 4. Log warning if still over cap
 *
 * The caller provides a callback to rebuild Layer 2 with fewer messages
 * so this module stays decoupled from message structure.
 */
export function enforceTokenBudget(
  layers: ContextLayers,
  rebuildActiveWithFewerMessages?: (maxMessages: number) => string,
): BudgetResult {
  const trimActions: string[] = []
  let current = { ...layers }
  let total = countTokensMulti([current.static, current.active, current.retrieved])

  // Under cap — return as-is
  if (total <= TOKEN_HARD_CAP) {
    return { layers: current, totalTokens: total, trimmed: false, trimActions }
  }

  // Step 1: Drop Layer 3
  if (current.retrieved) {
    trimActions.push('dropped Layer 3 (retrieved context)')
    current = { ...current, retrieved: '' }
    total = countTokensMulti([current.static, current.active, current.retrieved])
    if (total <= TOKEN_HARD_CAP) {
      return { layers: current, totalTokens: total, trimmed: true, trimActions }
    }
  }

  // Step 2: Compress school artifact in Layer 2
  // Look for the school artifact section and truncate it
  const artifactMarker = '[SCHOOL ARTIFACT]'
  const artifactEnd = '[/SCHOOL ARTIFACT]'
  const artStart = current.active.indexOf(artifactMarker)
  const artEnd = current.active.indexOf(artifactEnd)
  if (artStart !== -1 && artEnd !== -1) {
    const before = current.active.substring(0, artStart + artifactMarker.length)
    const after = current.active.substring(artEnd)
    const artifactContent = current.active.substring(artStart + artifactMarker.length, artEnd)
    const compressed = artifactContent.substring(0, 200) + '... (truncated)'
    current = { ...current, active: before + compressed + after }
    trimActions.push('compressed school artifact to 200 chars')
    total = countTokensMulti([current.static, current.active, current.retrieved])
    if (total <= TOKEN_HARD_CAP) {
      return { layers: current, totalTokens: total, trimmed: true, trimActions }
    }
  }

  // Step 3: Reduce rolling window 6 → 4 messages
  if (rebuildActiveWithFewerMessages) {
    current = { ...current, active: rebuildActiveWithFewerMessages(4) }
    trimActions.push('reduced rolling message window from 6 to 4')
    total = countTokensMulti([current.static, current.active, current.retrieved])
    if (total <= TOKEN_HARD_CAP) {
      return { layers: current, totalTokens: total, trimmed: true, trimActions }
    }
  }

  // Still over — log warning but return what we have
  trimActions.push(`WARNING: still at ${total} tokens after all trims (cap: ${TOKEN_HARD_CAP})`)
  console.warn(`[countTokens] Token budget exceeded after all trim steps: ${total} tokens`)

  return { layers: current, totalTokens: total, trimmed: true, trimActions }
}

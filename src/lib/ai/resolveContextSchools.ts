/**
 * Parse incoming user messages for school references.
 *
 * Returns resolved school IDs based on the type of reference:
 * - Single school mention → 1 ID
 * - Comparison request (vs, compare, side-by-side) → 2-3 IDs
 * - General question (no school mention) → 0 IDs
 *
 * Uses the current shortlist / active schools from conversation context
 * to match fuzzy school name mentions to actual IDs.
 *
 * Part of E52-A3: Context Assembler & Token Budget Manager.
 */

export interface SchoolRef {
  id: string
  name: string
}

export interface ResolveResult {
  /** 'single' | 'comparison' | 'general' */
  type: 'single' | 'comparison' | 'general'
  /** Resolved school IDs (0, 1, 2, or 3) */
  schoolIds: string[]
  /** Matched school refs with names for context assembly */
  matched: SchoolRef[]
}

/** Patterns that signal a comparison intent */
const COMPARISON_PATTERNS = [
  /\b(compare|comparing|comparison)\b/i,
  /\b(versus|vs\.?)\b/i,
  /\bside[\s-]by[\s-]side\b/i,
  /\bdifference(?:s)?\s+between\b/i,
  /\b(?:which|what).+(?:better|best|prefer)\b/i,
  /\b(\w+)\s+(?:or|and)\s+(\w+)\s+(?:school|academy|college)\b/i,
]

/**
 * Resolve school references from a user message.
 *
 * @param message - The user's message text
 * @param knownSchools - Schools currently in context (shortlist, results, etc.)
 * @returns ResolveResult with type and matched school IDs
 */
export function resolveContextSchools(
  message: string,
  knownSchools: SchoolRef[],
): ResolveResult {
  if (!message?.trim() || !knownSchools?.length) {
    return { type: 'general', schoolIds: [], matched: [] }
  }

  const lowerMessage = message.toLowerCase()

  // Check if this is a comparison intent
  const isComparison = COMPARISON_PATTERNS.some(p => p.test(message))

  // Match known school names in the message (fuzzy: case-insensitive substring)
  const matched: SchoolRef[] = []
  const seen = new Set<string>()

  for (const school of knownSchools) {
    if (!school.name || seen.has(school.id)) continue

    // Try exact name match first, then significant words
    const lowerName = school.name.toLowerCase()

    if (lowerMessage.includes(lowerName)) {
      matched.push(school)
      seen.add(school.id)
      continue
    }

    // Try matching on significant words (3+ chars, skip common words)
    const words = lowerName
      .split(/[\s\-,]+/)
      .filter(w => w.length >= 3 && !SKIP_WORDS.has(w))

    // Require at least 2 significant word matches, or 1 if the school
    // name only has 1 significant word
    const matchCount = words.filter(w => lowerMessage.includes(w)).length
    const threshold = words.length === 1 ? 1 : 2

    if (words.length > 0 && matchCount >= threshold) {
      matched.push(school)
      seen.add(school.id)
    }
  }

  // Determine type
  if (matched.length === 0) {
    return { type: 'general', schoolIds: [], matched: [] }
  }

  if (isComparison && matched.length >= 2) {
    // Cap at 3 schools for comparison
    const capped = matched.slice(0, 3)
    return {
      type: 'comparison',
      schoolIds: capped.map(s => s.id),
      matched: capped,
    }
  }

  if (matched.length === 1) {
    return {
      type: 'single',
      schoolIds: [matched[0].id],
      matched: [matched[0]],
    }
  }

  // Multiple schools mentioned but no comparison intent — treat as comparison anyway
  if (matched.length >= 2) {
    const capped = matched.slice(0, 3)
    return {
      type: 'comparison',
      schoolIds: capped.map(s => s.id),
      matched: capped,
    }
  }

  return { type: 'general', schoolIds: [], matched: [] }
}

// Common words to skip during fuzzy matching
const SKIP_WORDS = new Set([
  'the', 'of', 'and', 'for', 'in', 'at', 'to', 'a', 'an',
  'school', 'academy', 'college', 'institute', 'centre', 'center',
  'private', 'public', 'international',
])

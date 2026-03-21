/**
 * Layered, token-aware prompt context assembly.
 *
 * Three layers:
 *   Layer 1 — Static (~600 tok): system instructions, family brief, session state
 *   Layer 2 — Active (~1550 tok): rolling summaries, recent messages, active school artifacts
 *   Layer 3 — Retrieved (~700 tok): on-demand comparison / semantic context
 *
 * Target: under 2500 tokens. Hard cap: 4000 tokens.
 * If over cap, trims in priority order (see countTokens.ts).
 *
 * Integrates with E52-A2 retrieveSummaries for Layer 2 summary chunks.
 *
 * Part of E52-A3: Context Assembler & Token Budget Manager.
 */

import {
  countTokens,
  enforceTokenBudget,
  TOKEN_TARGET,
  TOKEN_HARD_CAP,
  type ContextLayers,
  type BudgetResult,
} from './countTokens'
import {
  getLatestSummaries,
  buildSummaryContext,
  type StoredSummary,
} from './retrieveSummaries'
import {
  resolveContextSchools,
  type SchoolRef,
  type ResolveResult,
} from './resolveContextSchools'

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface FamilyBrief {
  parentName?: string
  childName?: string
  grade?: number | string | null
  location?: string
  budget?: number | string | null
  schoolTypePreferences?: string[]
  pronoun?: string
  priorities?: string[]
  dealbreakers?: string[]
}

export interface SessionState {
  currentState: string
  consultantName?: string
  turnCount?: number
  selectedSchoolId?: string | null
  journeyId?: string | null
}

export interface SchoolArtifact {
  schoolId: string
  name: string
  summary: string
}

export interface BuildContextParams {
  /** The user's current message */
  userMessage: string
  /** System-level persona / instructions (pre-built by caller) */
  systemInstructions: string
  /** Family brief data (from guided intro or profile) */
  familyBrief?: FamilyBrief | null
  /** Current session/conversation state */
  sessionState: SessionState
  /** Recent conversation messages (newest last) */
  conversationHistory?: ChatMessage[]
  /** Conversation ID for summary retrieval */
  conversationId?: string
  /** Schools currently in context (shortlist, results) */
  knownSchools?: SchoolRef[]
  /** Pre-fetched school artifacts (summaries for shortlisted schools) */
  schoolArtifacts?: SchoolArtifact[]
  /** Optional: pre-fetched summaries (skips DB call if provided) */
  prefetchedSummaries?: StoredSummary[]
  /** Max recent messages to include (default 6, trimmed to 4 under pressure) */
  maxRecentMessages?: number
}

export interface BuildContextResult {
  /** The assembled context string (all layers joined) */
  context: string
  /** Individual layer strings */
  layers: ContextLayers
  /** Total token count */
  totalTokens: number
  /** Whether trimming was applied */
  trimmed: boolean
  /** List of trim actions taken (if any) */
  trimActions: string[]
  /** Resolved school references from the user message */
  schoolResolution: ResolveResult
}

// ─── Default message window ──────────────────────────────────────────

const DEFAULT_MAX_MESSAGES = 6
const REDUCED_MAX_MESSAGES = 4

// ─── Main entry point ────────────────────────────────────────────────

/**
 * Assemble a token-budgeted, 3-layer prompt context.
 *
 * This function is synchronous for Layer 1 and Layer 3,
 * but async for Layer 2 (summary retrieval from DB).
 * Total assembly completes in <100ms excluding API/DB calls.
 */
export async function buildPromptContext(
  params: BuildContextParams,
): Promise<BuildContextResult> {
  const {
    userMessage,
    systemInstructions,
    familyBrief,
    sessionState,
    conversationHistory = [],
    conversationId,
    knownSchools = [],
    schoolArtifacts = [],
    prefetchedSummaries,
    maxRecentMessages = DEFAULT_MAX_MESSAGES,
  } = params

  // ── Resolve school references from user message ──
  const schoolResolution = resolveContextSchools(userMessage, knownSchools)

  // ── Layer 1: Static context ──
  const staticLayer = buildStaticLayer(systemInstructions, familyBrief, sessionState)

  // ── Layer 2: Active context (async for summaries) ──
  const summaries = prefetchedSummaries ?? (
    conversationId ? await getLatestSummaries(conversationId, 3) : []
  )
  const activeLayer = buildActiveLayer(
    summaries,
    conversationHistory,
    schoolArtifacts,
    schoolResolution,
    maxRecentMessages,
  )

  // ── Layer 3: Retrieved context ──
  const retrievedLayer = buildRetrievedLayer(
    schoolResolution,
    schoolArtifacts,
    knownSchools,
  )

  // ── Enforce token budget ──
  const rawLayers: ContextLayers = {
    static: staticLayer,
    active: activeLayer,
    retrieved: retrievedLayer,
  }

  // Provide a callback to rebuild Layer 2 with fewer messages
  const rebuildActive = (maxMsgs: number) => buildActiveLayer(
    summaries,
    conversationHistory,
    schoolArtifacts,
    schoolResolution,
    maxMsgs,
  )

  const budget: BudgetResult = enforceTokenBudget(rawLayers, rebuildActive)

  // ── Assemble final context string ──
  const parts = [budget.layers.static, budget.layers.active, budget.layers.retrieved]
    .filter(Boolean)
  const context = parts.join('\n\n')

  if (budget.trimmed) {
    console.log(`[buildPromptContext] Trimmed context: ${budget.trimActions.join(', ')} | Final: ${budget.totalTokens} tokens`)
  }

  return {
    context,
    layers: budget.layers,
    totalTokens: budget.totalTokens,
    trimmed: budget.trimmed,
    trimActions: budget.trimActions,
    schoolResolution,
  }
}

// ─── Layer builders ──────────────────────────────────────────────────

/**
 * Layer 1: Static context (~600 tokens target)
 * System instructions + family brief + session state
 */
function buildStaticLayer(
  systemInstructions: string,
  familyBrief?: FamilyBrief | null,
  sessionState?: SessionState,
): string {
  const parts: string[] = []

  // System instructions (persona, rules)
  if (systemInstructions) {
    parts.push(systemInstructions)
  }

  // Family brief
  if (familyBrief) {
    const briefLines: string[] = []
    if (familyBrief.childName) briefLines.push(`Child: ${familyBrief.childName}`)
    if (familyBrief.grade != null) briefLines.push(`Grade: ${familyBrief.grade}`)
    if (familyBrief.location) briefLines.push(`Location: ${familyBrief.location}`)
    if (familyBrief.budget) briefLines.push(`Budget: $${Number(familyBrief.budget).toLocaleString()}`)
    if (familyBrief.schoolTypePreferences?.length) {
      briefLines.push(`School types: ${familyBrief.schoolTypePreferences.join(', ')}`)
    }
    if (familyBrief.priorities?.length) {
      briefLines.push(`Priorities: ${familyBrief.priorities.join(', ')}`)
    }
    if (familyBrief.dealbreakers?.length) {
      briefLines.push(`Dealbreakers: ${familyBrief.dealbreakers.join(', ')}`)
    }
    if (familyBrief.pronoun) briefLines.push(`Pronoun: ${familyBrief.pronoun}`)

    if (briefLines.length > 0) {
      parts.push(`FAMILY BRIEF:\n- ${briefLines.join('\n- ')}`)
    }
  }

  // Session state
  if (sessionState) {
    const stateLines: string[] = []
    stateLines.push(`State: ${sessionState.currentState}`)
    if (sessionState.consultantName) stateLines.push(`Consultant: ${sessionState.consultantName}`)
    if (sessionState.turnCount != null) stateLines.push(`Turn: ${sessionState.turnCount}`)
    if (sessionState.selectedSchoolId) stateLines.push(`Selected school: ${sessionState.selectedSchoolId}`)
    parts.push(`SESSION STATE:\n- ${stateLines.join('\n- ')}`)
  }

  return parts.join('\n\n')
}

/**
 * Layer 2: Active context (~1550 tokens target)
 * Rolling summaries + recent messages + active school artifact
 */
function buildActiveLayer(
  summaries: StoredSummary[],
  conversationHistory: ChatMessage[],
  schoolArtifacts: SchoolArtifact[],
  schoolResolution: ResolveResult,
  maxMessages: number,
): string {
  const parts: string[] = []

  // Rolling summaries from E52-A2
  const summaryContext = buildSummaryContext(summaries)
  if (summaryContext) {
    parts.push(`CONVERSATION MEMORY:\n${summaryContext}`)
  }

  // Recent messages (rolling window)
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-maxMessages)
    const formatted = recent
      .filter(m => m?.content)
      .map(m => `${m.role === 'user' ? 'Parent' : m.role === 'assistant' ? 'Consultant' : 'System'}: ${m.content}`)
      .join('\n')
    if (formatted) {
      parts.push(`RECENT CONVERSATION:\n${formatted}`)
    }
  }

  // Active school artifact (for the selected/referenced school)
  if (schoolResolution.type === 'single' && schoolResolution.schoolIds.length === 1) {
    const artifact = schoolArtifacts.find(a => a.schoolId === schoolResolution.schoolIds[0])
    if (artifact) {
      parts.push(`[SCHOOL ARTIFACT]${artifact.name}: ${artifact.summary}[/SCHOOL ARTIFACT]`)
    }
  }

  return parts.join('\n\n')
}

/**
 * Layer 3: Retrieved context (~700 tokens target)
 * On-demand comparison data or semantic context
 */
function buildRetrievedLayer(
  schoolResolution: ResolveResult,
  schoolArtifacts: SchoolArtifact[],
  knownSchools: SchoolRef[],
): string {
  // Only populated for comparison or single-school deep context
  if (schoolResolution.type === 'comparison' && schoolResolution.matched.length >= 2) {
    const comparisonParts = schoolResolution.matched.map(ref => {
      const artifact = schoolArtifacts.find(a => a.schoolId === ref.id)
      if (artifact) {
        return `${artifact.name}: ${artifact.summary}`
      }
      return `${ref.name}: (no detailed data available)`
    })

    return `COMPARISON CONTEXT:\n${comparisonParts.join('\n\n')}`
  }

  // For single school references where we have additional context
  if (schoolResolution.type === 'single' && schoolResolution.schoolIds.length === 1) {
    // Additional retrieved context (semantic search results, etc.)
    // could be injected here by the caller via schoolArtifacts
    // For now, Layer 3 is empty for single-school (artifact is in Layer 2)
    return ''
  }

  return ''
}

// ─── Utility: quick token estimate without DB calls ──────────────────

/**
 * Synchronous version that skips summary retrieval.
 * Useful for quick estimates or when summaries are pre-fetched.
 */
export function buildPromptContextSync(
  params: Omit<BuildContextParams, 'conversationId'> & { prefetchedSummaries?: StoredSummary[] },
): BuildContextResult {
  const {
    userMessage,
    systemInstructions,
    familyBrief,
    sessionState,
    conversationHistory = [],
    knownSchools = [],
    schoolArtifacts = [],
    prefetchedSummaries = [],
    maxRecentMessages = DEFAULT_MAX_MESSAGES,
  } = params

  const schoolResolution = resolveContextSchools(userMessage, knownSchools)

  const staticLayer = buildStaticLayer(systemInstructions, familyBrief, sessionState)
  const activeLayer = buildActiveLayer(
    prefetchedSummaries, conversationHistory, schoolArtifacts, schoolResolution, maxRecentMessages,
  )
  const retrievedLayer = buildRetrievedLayer(schoolResolution, schoolArtifacts, knownSchools)

  const rawLayers: ContextLayers = { static: staticLayer, active: activeLayer, retrieved: retrievedLayer }

  const rebuildActive = (maxMsgs: number) => buildActiveLayer(
    prefetchedSummaries, conversationHistory, schoolArtifacts, schoolResolution, maxMsgs,
  )

  const budget = enforceTokenBudget(rawLayers, rebuildActive)
  const parts = [budget.layers.static, budget.layers.active, budget.layers.retrieved].filter(Boolean)

  return {
    context: parts.join('\n\n'),
    layers: budget.layers,
    totalTokens: budget.totalTokens,
    trimmed: budget.trimmed,
    trimActions: budget.trimActions,
    schoolResolution,
  }
}

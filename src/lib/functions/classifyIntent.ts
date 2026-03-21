// Function: classifyIntent
// Purpose: E52-B1 — Lightweight regex-based pre-classifier for all app states.
//   Returns gate (6 types) + confidence + optional school refs in ~1-5ms (no LLM call).
//   Used by orchestrateConversation.ts to fast-path route messages.
//   Generous default: ambiguous messages fall through as TASK_DRIVEN/LOW so the AI
//   treats them as potentially task-related rather than ignoring intent signals.
// Last Modified: 2026-03-21

import { detectOffTopic } from './detectOffTopic';

export interface SessionState {
  selectedSchool?: string;
  recentActionEvents?: string[];
  activeTab?: string;
}

export interface ClassifyIntentResult {
  gate: 'ACTION' | 'ACTION_ADJACENT' | 'TASK_DRIVEN' | 'CLARIFICATION' | 'OFF_TOPIC' | 'CONVERSATION';
  actionHint?: string;
  confidence: 'HIGH' | 'LOW';
  referencedSchools?: string[];
}

// Ordered map: first match wins. More specific patterns listed first.
const ACTION_PATTERNS: Array<{ hint: string; re: RegExp }> = [
  // --- Existing E41 patterns (unchanged) ---
  { hint: 'shortlist',  re: /\b(add|shortlist|save|bookmark|keep)\b/i },
  { hint: 'compare',   re: /\b(compare|versus|vs\.?|side[\s-]by[\s-]side)\b|difference between .+ and /i },
  { hint: 'filter',    re: /\b(filter|only show|hide|just .+ schools?)\b/i },
  { hint: 'edit',      re: /\b(change .+ to|budget .+ (is|now)|actually .+ not|update my|new budget|budget is now|budget changed)\b/i },
  { hint: 'journey',   re: /\b(book .+ tour|schedule .+ (tour|visit)|apply|open house|campus visit)\b/i },
  { hint: 'expand',    re: /\b(deep dive|tell me everything|full (report|analysis|profile))\b/i },
  { hint: 'load-more', re: /\b(show more|load more|more schools?|see more)\b/i },
  { hint: 'sort',      re: /\b(sort by|closest first|sort (by )?distance|sort (by )?tuition|order by)\b/i },
  { hint: 'open-panel', re: /\b(open (my )?(shortlist|brief|comparison)|show (my )?(shortlist|brief))\b/i },
  // --- New E52-B1 patterns ---
  { hint: 'visit-mark',     re: /\b(I went to|I visited|we visited|we went to|toured|we toured)\b/i },
  { hint: 'debrief-open',   re: /\b(add my (impressions|notes|thoughts)|debrief|my visit (notes|impressions)|how was my visit)\b/i },
  { hint: 'notepad-open',   re: /\b(open (my )?notepad|show (my )?notes|my notes)\b/i },
  { hint: 'event-register', re: /\b(register for|sign up for|rsvp|attend .+ event)\b/i },
];

// ACTION_ADJACENT: user references a recent action (e.g. "why did you suggest that?")
const ACTION_ADJACENT_RE = /\b(why|how come|what made you|reason|explain|why did you|why that|why those|what about)\b/i;

// CLARIFICATION: short ambiguous messages
const CLARIFICATION_RE = /^(ok|okay|sure|thanks|thank you|yes|no|yep|nope|alright|got it|hmm|hm|right|cool|fine|great|good|k|yea|yeah|nah|mhm)\.?!?\s*$/i;

export function classifyIntentLogic(message: string, sessionState?: SessionState): ClassifyIntentResult {
  if (!message || message.trim().length === 0) {
    return { gate: 'CONVERSATION', confidence: 'HIGH' };
  }

  const trimmed = message.trim();

  // 1. ACTION patterns — first match wins
  for (const { hint, re } of ACTION_PATTERNS) {
    if (re.test(trimmed)) {
      return { gate: 'ACTION', actionHint: hint, confidence: 'HIGH' };
    }
  }

  // 2. OFF_TOPIC — regex blocklist (~1ms)
  if (detectOffTopic(trimmed)) {
    return { gate: 'OFF_TOPIC', confidence: 'HIGH' };
  }

  // 3. ACTION_ADJACENT — recent action event + message references it
  if (
    sessionState?.recentActionEvents &&
    sessionState.recentActionEvents.length > 0 &&
    ACTION_ADJACENT_RE.test(trimmed)
  ) {
    return { gate: 'ACTION_ADJACENT', confidence: 'HIGH' };
  }

  // 4. CLARIFICATION — short ambiguous acknowledgements
  if (CLARIFICATION_RE.test(trimmed)) {
    return { gate: 'CLARIFICATION', confidence: 'LOW' };
  }

  // 5. Fallback — generous default: treat ambiguous messages as potentially task-related (E52-B1)
  return { gate: 'TASK_DRIVEN', confidence: 'LOW' };
}

// Function: classifyIntent
// Purpose: E41-S2 — Lightweight regex-based pre-classifier for RESULTS state messages.
//   Returns { gate: 'ACTION' | 'CONVERSATION', actionHint?: string } in ~5-50ms (no LLM call).
//   Used by orchestrateConversation.ts to fast-path route before calling handleResults.
//   handleResults LLM prompt (S1 two-gate) acts as belt-and-suspenders fallback.
// Last Modified: 2026-03-17

export interface ClassifyIntentResult {
  gate: 'ACTION' | 'CONVERSATION';
  actionHint?: string;
}

// Ordered map: first match wins. More specific patterns listed first.
const ACTION_PATTERNS: Array<{ hint: string; re: RegExp }> = [
  { hint: 'shortlist',  re: /\b(add|shortlist|save|bookmark|keep)\b/i },
  { hint: 'compare',   re: /\b(compare|versus|vs\.?|side[\s-]by[\s-]side)\b|difference between .+ and /i },
  { hint: 'filter',    re: /\b(filter|only show|hide|just .+ schools?)\b/i },
  { hint: 'edit',      re: /\b(change .+ to|budget .+ (is|now)|actually .+ not|update my|new budget|budget is now|budget changed)\b/i },
  { hint: 'journey',   re: /\b(book .+ tour|schedule .+ (tour|visit)|apply|open house|campus visit)\b/i },
  { hint: 'expand',    re: /\b(deep dive|tell me everything|full (report|analysis|profile))\b/i },
  { hint: 'load-more', re: /\b(show more|load more|more schools?|see more)\b/i },
  { hint: 'sort',      re: /\b(sort by|closest first|sort (by )?distance|sort (by )?tuition|order by)\b/i },
  { hint: 'open-panel', re: /\b(open (my )?(shortlist|brief|comparison)|show (my )?(shortlist|brief))\b/i },
];

export function classifyIntent(message: string): ClassifyIntentResult {
  if (!message || message.trim().length === 0) {
    return { gate: 'CONVERSATION' };
  }
  for (const { hint, re } of ACTION_PATTERNS) {
    if (re.test(message)) {
      return { gate: 'ACTION', actionHint: hint };
    }
  }
  return { gate: 'CONVERSATION' };
}

// =============================================================================
// Deno HTTP handler — allows this to be invoked as a standalone function
// for testing and direct invocation via base44.functions.invoke
// =============================================================================
Deno.serve(async (req) => {
  try {
    const { message } = await req.json();
    const result = classifyIntent(message || '');
    return Response.json(result);
  } catch (e) {
    return Response.json({ gate: 'CONVERSATION' }, { status: 200 });
  }
});

// @ts-nocheck
// Function: fireJourneyUpdate
// Purpose: Fire-and-forget — runs next-action inference AND session summary in parallel,
//          then writes a single FamilyJourney.update. Called at RESULTS + DEEP_DIVE exits.
// Last Modified: 2026-03-18
// Dependencies: callOpenRouter, FamilyJourney entity
// E29-010 + E29-012

import { FamilyJourney } from '@/lib/entities-server'
import { callOpenRouter } from './callOpenRouter'

export function fireJourneyUpdate(journeyContext, context, conversationHistory, lastUserMessage, phase) {
  const journeyId = journeyContext?.journeyId || context?.journeyId;
  if (!journeyId) return;

  (async () => {
    try {
      const schoolLines = (journeyContext?.schoolsSummary || [])
        .map(s => `- ${s.schoolName}: ${s.status}`)
        .join('\n') || 'None shortlisted yet.';
      const currentPhase = journeyContext?.currentPhase || 'MATCH';
      const priorSummary = journeyContext?.lastSessionSummary || 'N/A';

      // Build a short conversation snippet for the summary (last 6 turns)
      const recentTurns = (conversationHistory || []).slice(-6)
        .filter(m => m?.content)
        .map(m => `${m.role === 'user' ? 'Parent' : 'Consultant'}: ${m.content}`)
        .join('\n');
      const conversationSnippet = recentTurns
        ? `${recentTurns}\nParent: ${lastUserMessage || ''}`
        : `Parent: ${lastUserMessage || ''}`;

      const nextActionPrompt = `You are an education consultant assistant. Based on the following school journey, generate the single most important next action for this family.

Schools:
${schoolLines}
Current phase: ${currentPhase}
Last session: ${priorSummary}

Respond with ONLY a JSON object: { "nextAction": "<one specific sentence>", "nextActionType": "<TOUR|COMPARE|APPLY|REVIEW|FOLLOWUP>", "nextActionDue": "<ISO date within 2 weeks>" }
Keep nextAction under 100 characters. Be specific about school names.`;

      const summaryPrompt = `You are an education consultant assistant. Summarize this school search session in exactly 3 sentences for future reference. Be specific: mention schools discussed, decisions made, and what the family is considering next.

Conversation:
${conversationSnippet}

Schools: ${schoolLines}
Phase: ${currentPhase}

Write 3 sentences only. No headings, no bullet points.`;

      const [nextActionRaw, summaryRaw] = await Promise.all([
        Promise.race([
          callOpenRouter({
            prompt: nextActionPrompt,
            response_json_schema: {
              type: 'object',
              properties: {
                nextAction: { type: 'string' },
                nextActionType: { type: 'string' },
                nextActionDue: { type: 'string' }
              },
              required: ['nextAction', 'nextActionType', 'nextActionDue']
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
        ]),
        Promise.race([
          callOpenRouter({ prompt: summaryPrompt }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
        ])
      ]);

      const parsedAction = typeof nextActionRaw === 'object' ? nextActionRaw : JSON.parse(nextActionRaw);
      const summaryText = typeof summaryRaw === 'string' ? summaryRaw : (summaryRaw?.response || summaryRaw?.text || priorSummary);

      const currentTotal = journeyContext?.totalSessions || 0;

      await FamilyJourney.update(journeyId, {
        nextAction: parsedAction.nextAction,
        nextActionType: parsedAction.nextActionType,
        nextActionDue: parsedAction.nextActionDue,
        lastSessionSummary: summaryText,
        totalSessions: currentTotal + 1,
        lastActiveAt: new Date().toISOString()
      });

      console.log(`[E29-010/012] FamilyJourney updated (${phase}): nextAction="${parsedAction.nextAction}", sessions=${currentTotal + 1}`);
    } catch (e) {
      console.warn(`[E29-010/012] fireJourneyUpdate skipped (${phase}):`, e.message);
    }
  })();
}

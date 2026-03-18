// @ts-nocheck
// Function: actionValidation
// Purpose: UI Action validation, intent classification, and action schema constants
// Last Modified: 2026-03-18
// Dependencies: LLMLog entity
// E32-001: UI Action validation helpers
// E41-S2: Inline classifyIntent — regex keyword gate, no LLM (~5-50ms)
// E41-S6/S7/S10: Extended action types

import { LLMLog } from '@/lib/entities-server'

export const V1_ACTION_TYPES = ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL', 'INITIATE_TOUR', 'EDIT_CRITERIA', 'FILTER_SCHOOLS', 'LOAD_MORE', 'SORT_SCHOOLS'];
export const VALID_PANELS = ['shortlist', 'comparison', 'brief'];
export const ACTION_TOOL_SCHEMA = [{ type: 'function', function: { name: 'execute_ui_action', description: 'Execute UI actions alongside your text response when the user wants to add schools to shortlist, open panels, expand school details, edit criteria, filter results, load more schools, or sort results', parameters: { type: 'object', properties: { actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL', 'INITIATE_TOUR', 'EDIT_CRITERIA', 'FILTER_SCHOOLS', 'LOAD_MORE', 'SORT_SCHOOLS'] }, schoolId: { type: 'string', description: 'School entity ID (for ADD_TO_SHORTLIST, EXPAND_SCHOOL)' }, panel: { type: 'string', enum: ['shortlist', 'comparison', 'brief'] }, profileDelta: { type: 'object', description: 'Profile fields to update for EDIT_CRITERIA (e.g. { maxTuition: 25000 })' }, filters: { type: 'object', description: 'Filter overrides for FILTER_SCHOOLS', properties: { boardingType: { type: 'string', enum: ['boarding', 'day', 'both'] }, curriculum: { type: 'string' }, gender: { type: 'string', enum: ['boys', 'girls', 'coed'] }, religiousAffiliation: { type: 'string' }, clear: { type: 'boolean' } } }, sortBy: { type: 'string', enum: ['distance', 'tuition', 'default'], description: 'Sort field for SORT_SCHOOLS' } }, required: ['type'] } } }, required: ['actions'] } } }];

// =============================================================================
// E41-S2: classifyIntent — regex keyword gate, no LLM (~5-50ms)
// =============================================================================
const CLASSIFY_INTENT_ACTION_PATTERNS: Array<{ hint: string; re: RegExp }> = [
  { hint: 'shortlist',   re: /\b(add|shortlist|save|bookmark|keep)\b/i },
  { hint: 'compare',     re: /\b(compare|versus|vs\.?|side[\s-]by[\s-]side)\b|difference between .+ and /i },
  { hint: 'filter',      re: /\b(filter|only show|hide|just .+ schools?)\b/i },
  { hint: 'edit',        re: /\b(change .+ to|budget .+ (is|now)|actually .+ not|update my|new budget|budget is now|budget changed)\b/i },
  { hint: 'journey',     re: /\b(book .+ tour|schedule .+ (tour|visit)|apply|open house|campus visit)\b/i },
  { hint: 'expand',      re: /\b(deep dive|tell me everything|full (report|analysis|profile))\b/i },
  { hint: 'load-more',   re: /\b(show more|load more|more schools?|see more)\b/i },
  { hint: 'sort',        re: /\b(sort by|closest first|sort (by )?distance|sort (by )?tuition|order by)\b/i },
  { hint: 'open-panel',  re: /\b(open (my )?(shortlist|brief|comparison)|show (my )?(shortlist|brief))\b/i },
];

export function classifyIntentFn(message: string): { gate: 'ACTION' | 'CONVERSATION'; actionHint?: string } {
  if (!message || message.trim().length === 0) return { gate: 'CONVERSATION' };
  for (const { hint, re } of CLASSIFY_INTENT_ACTION_PATTERNS) {
    if (re.test(message)) return { gate: 'ACTION', actionHint: hint };
  }
  return { gate: 'CONVERSATION' };
}

export function validateActions(rawToolCalls, validSchoolIds, conversationId) {
  const validatedActions: any[] = [];
  if (!rawToolCalls || !Array.isArray(rawToolCalls)) return validatedActions;
  for (const tc of rawToolCalls) {
    try {
      const args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments;
      if (!args?.actions || !Array.isArray(args.actions)) continue;
      for (const action of args.actions) {
        if (!V1_ACTION_TYPES.includes(action.type)) { logDroppedAction( conversationId, action, 'INVALID_TYPE'); continue; }
        if ((action.type === 'ADD_TO_SHORTLIST' || action.type === 'EXPAND_SCHOOL') && !validSchoolIds.has(action.schoolId)) { logDroppedAction( conversationId, action, 'INVALID_SCHOOL_ID'); continue; }
        if (action.type === 'OPEN_PANEL' && !VALID_PANELS.includes(action.panel)) { logDroppedAction( conversationId, action, 'INVALID_PANEL'); continue; }
        const timing = action.type === 'ADD_TO_SHORTLIST' ? 'immediate' : 'after_message';
        // E41: Build payload for extended action types
        let payload: Record<string, unknown> = { schoolId: action.schoolId };
        if (action.type === 'OPEN_PANEL') payload = { panel: action.panel };
        else if (action.type === 'EDIT_CRITERIA') payload = { profileDelta: action.profileDelta || {} };
        else if (action.type === 'FILTER_SCHOOLS') payload = { filters: action.filters || {} };
        else if (action.type === 'SORT_SCHOOLS') payload = { sortBy: action.sortBy || 'default' };
        else if (action.type === 'LOAD_MORE') payload = {};
        validatedActions.push({ type: action.type, payload, timing });
      }
    } catch (e) { logDroppedAction( conversationId, tc, 'PARSE_ERROR'); }
  }
  return validatedActions;
}

async function logDroppedAction( conversationId, action, reason) {
  try { await LLMLog.create({ conversationId: conversationId || 'unknown', phase: 'ACTION_VALIDATION', status: 'ACTION_DROPPED', prompt_summary: JSON.stringify(action).substring(0, 100), response_summary: reason }); } catch (e) { console.error('[E32] Failed to log dropped action:', e.message); }
}

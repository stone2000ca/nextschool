// Function: guardrailResponse
// Purpose: E52-B2 — Tiered warm deflections when OFF_TOPIC fires.
//   Tier 1: warm deflection + contextual hook from session state
//   Tier 2: light humor + open invitation
//   Tier 3+: single patient line
// Last Modified: 2026-03-21

export interface GuardrailSessionContext {
  shortlistCount?: number;
  activeSchoolName?: string | null;
  hasActiveDebrief?: boolean;
  journeyPhase?: string | null;
  consultantName?: string | null;
}

function getContextualHook(ctx: GuardrailSessionContext): string {
  if (ctx.hasActiveDebrief) {
    return "You mentioned visiting a school — want to add your impressions?";
  }
  if (ctx.activeSchoolName) {
    return `We were looking at ${ctx.activeSchoolName} — any questions about it?`;
  }
  if (ctx.shortlistCount && ctx.shortlistCount > 0) {
    return `You've got ${ctx.shortlistCount} school${ctx.shortlistCount === 1 ? '' : 's'} shortlisted — want to dig into any of them?`;
  }
  if (ctx.journeyPhase === 'VISIT' || ctx.journeyPhase === 'DECIDE') {
    return "Ready to pick up where we left off on your school search?";
  }
  return "What can I help you find in your school search?";
}

export function guardrailResponse(offTopicCount: number, ctx: GuardrailSessionContext): string {
  const isJackie = ctx.consultantName !== 'Liam';

  // Tier 3+: patient single line
  if (offTopicCount >= 3) {
    return "I'm here whenever you're ready to talk schools.";
  }

  // Tier 2: light humor + open invitation
  if (offTopicCount === 2) {
    return isJackie
      ? "Ha — I wish I could help with that! Schools are my thing though. What's on your mind about the search?"
      : "That's outside my lane. I'm best at school strategy — what would you like to work on?";
  }

  // Tier 1: warm deflection + contextual hook
  const hook = getContextualHook(ctx);
  return isJackie
    ? `That's a bit outside what I can help with — but I'm all yours for the school search! ${hook}`
    : `I'm not the best resource for that, but I can definitely help with schools. ${hook}`;
}

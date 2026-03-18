// @ts-nocheck
// Function: handleDiscovery
// Purpose: DISCOVERY state handler — LLM-driven questionnaire for Tier 1 data collection
// Last Modified: 2026-03-18
// Dependencies: callOpenRouter
// Persona-specific (Jackie/Liam) system prompts for gathering grade, location, budget

import { callOpenRouter } from './callOpenRouter'

export async function handleDiscovery(message, conversationFamilyProfile, context, conversationHistory, consultantName, currentSchools, flags, returningUserContextBlock) {
  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE' };

  const history = conversationHistory || [];
  const recentMessages = history.slice(-10);
  const conversationSummary = recentMessages
    .filter(msg => msg?.content)
    .map(msg => `${msg.role === 'user' ? 'Parent' : 'Consultant'}: ${msg.content}`)
    .join('\n');

  const briefOfferInstruction = flags?.OFFER_BRIEF
    ? '\n\nIMPORTANT: You should offer to generate their Family Brief now.'
    : flags?.SUGGEST_BRIEF
    ? '\n\nIf it feels natural in the conversation, offer to generate their Family Brief.'
    : '';

  const hasGrade = conversationFamilyProfile?.childGrade !== null && conversationFamilyProfile?.childGrade !== undefined;
  const hasLocation = !!conversationFamilyProfile?.locationArea;
  const hasBudget = !!conversationFamilyProfile?.maxTuition;
  const hasGender = !!conversationFamilyProfile?.gender;

  const knownFacts: any[] = [];
   if (hasGrade) knownFacts.push(`grade ${conversationFamilyProfile.childGrade}`);
   if (hasGender) knownFacts.push(`${conversationFamilyProfile.gender}`);
   if (hasLocation) knownFacts.push(`location: ${conversationFamilyProfile.locationArea}`);
   if (hasBudget) knownFacts.push(`budget: $${conversationFamilyProfile.maxTuition}`);
   if (conversationFamilyProfile?.interests?.length > 0) knownFacts.push(`interests: ${conversationFamilyProfile.interests.join(', ')}`);
   if (conversationFamilyProfile?.priorities?.length > 0) knownFacts.push(`priorities: ${conversationFamilyProfile.priorities.join(', ')}`);
   if (conversationFamilyProfile?.dealbreakers?.length > 0) knownFacts.push(`dealbreakers: ${conversationFamilyProfile.dealbreakers.join(', ')}`);
   if (conversationFamilyProfile?.curriculumPreference?.length > 0) knownFacts.push(`curriculum: ${conversationFamilyProfile.curriculumPreference.join(', ')}`);
   if (conversationFamilyProfile?.childName) knownFacts.push(`child name: ${conversationFamilyProfile.childName}`);
   const knownSummary = knownFacts.length > 0
     ? `\nALREADY COLLECTED (DO NOT ASK AGAIN): ${knownFacts.join(', ')}.`
     : '';

  let tier1Guidance = '';
  const missingFields: any[] = [];
  if (!hasGrade) missingFields.push('grade/age');
  if (!hasGender) missingFields.push('gender (son or daughter)');
  if (!hasLocation) missingFields.push('location/area');
  if (!hasBudget) missingFields.push('tuition budget');

  if (missingFields.length >= 3) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields.join(', ')}. Ask about the two most important ones in your first response. After that, ask one at a time. Budget is always annual tuition. Do NOT ask to confirm if it is per year or per month. Accept the number as-is.`;
  } else if (missingFields.length === 2) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields.join(' and ')}. If this is your first response, you may ask about both. Otherwise, pick the most important one. Budget is always annual tuition. Accept the number as-is.`;
  } else if (missingFields.length === 1) {
    tier1Guidance = `TIER 1 PRIORITY: We still need: ${missingFields[0]}. Work this in naturally.`;
  }

  const personaInstructions = consultantName === 'Jackie'
    ? `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}[STATE: DISCOVERY] You are gathering family info to find the right school. Your primary goal is to collect Tier 1 data: child's grade/age, preferred location, and budget — in that priority order.
${knownSummary}
${tier1Guidance}
TURN MANAGEMENT: Transition to BRIEF within 5 turns maximum. If Tier 1 (grade, location, budget) is complete, do not exceed 1 enrichment turn — move to BRIEF on the next turn.
DUPLICATE QUESTION GUARD: Before asking any question, check the ALREADY COLLECTED list above. Never ask about a field that already has a value. If all Tier 1 fields are filled, do not ask about them again under any circumstances.
On your FIRST response only, you may ask about two related things together (e.g., grade and location). After the first turn, ask exactly ONE question per turn. Never ask more than one question after the first turn. Always answer their question first, then ask yours. Do NOT recommend schools or mention school names. CRITICAL FORMAT RULE: Your response must be MAX 2 sentences. Be conversational and warm, not robotic.
CRITICAL: Do NOT generate a brief, summary, or any bullet-point summary of the family's needs. You are ONLY asking questions right now. Do NOT interrupt emotional or contextual sharing — allow organic conversation flow. Keep gathering information.
CRITICAL: NEVER ask the user to confirm or repeat information they have already provided in this conversation. If they said their daughter is in grade 9, do not ask what grade again.
NEVER repeat a question verbatim that the user ignored or didn't answer. If they skip a question, either rephrase it completely or move on to the next priority. Never make the conversation feel like a form.${briefOfferInstruction}
YOU ARE JACKIE - Senior education consultant, 10+ years placing families in private schools. You're warm but efficient.`
    : `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}[STATE: DISCOVERY] You are gathering family info to find the right school. Your primary goal is to collect Tier 1 data: child's grade/age, preferred location, and budget — in that priority order.
${knownSummary}
${tier1Guidance}
TURN MANAGEMENT: Transition to BRIEF within 5 turns maximum. If Tier 1 (grade, location, budget) is complete, do not exceed 1 enrichment turn — move to BRIEF on the next turn.
DUPLICATE QUESTION GUARD: Before asking any question, check the ALREADY COLLECTED list above. Never ask about a field that already has a value. If all Tier 1 fields are filled, do not ask about them again under any circumstances.
On your FIRST response only, you may ask about two related things together (e.g., grade and location). After the first turn, ask exactly ONE question per turn. Never ask more than one question after the first turn. Always answer their question first, then ask yours. Do NOT recommend schools or mention school names. CRITICAL FORMAT RULE: Your response must be MAX 2 sentences. Be conversational and warm, not robotic.
CRITICAL: Do NOT generate a brief, summary, or any bullet-point summary of the family's needs. You are ONLY asking questions right now. Do NOT interrupt emotional or contextual sharing — allow organic conversation flow. Keep gathering information.
CRITICAL: NEVER ask the user to confirm or repeat information they have already provided in this conversation. If they said their daughter is in grade 9, do not ask what grade again.
NEVER repeat a question verbatim that the user ignored or didn't answer. If they skip a question, either rephrase it completely or move on to the next priority. Never make the conversation feel like a form.${briefOfferInstruction}
YOU ARE LIAM - Senior education strategist, 10+ years in private school placement. You're direct and data-driven.`;

  const discoveryUserPrompt = `Recent chat:\n${conversationSummary}\n\nParent: "${message}"\n\nRespond as ${consultantName}. 1 question (2 allowed on first turn only). No filler.`;

  let discoveryMessageRaw = 'Tell me more about your child.';
  try {
    discoveryMessageRaw = await callOpenRouter({
      systemPrompt: personaInstructions,
      userPrompt: discoveryUserPrompt,
      maxTokens: 300,
      temperature: 0.7,
      _logContext: { conversationId: context.conversationId || 'unknown', phase: 'DISCOVERY', is_test: false }
    });
    console.log('[DISCOVERY] Response via callOpenRouter (primary)');
  } catch (openRouterError) {
    console.log('[DISCOVERY] callOpenRouter failed, falling back to InvokeLLM with 8s timeout');
    try {
      const invokeResult = await Promise.race([
        callOpenRouter({
          prompt: personaInstructions + '\n\nRecent chat:\n' + conversationSummary + '\n\nParent: "' + message + '"\n\nRespond as ' + consultantName + '. 2-3 questions max. No filler.',
          model: 'gpt_5_mini',
          maxTokens: 200
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 8s')), 8000))
      ]);
      discoveryMessageRaw = invokeResult?.response || invokeResult || 'Tell me more about your child.';
      console.log('[DISCOVERY] Response via InvokeLLM (fallback)');
    } catch (invokeLLMError) {
      console.error('[DISCOVERY] Both LLM providers failed:', invokeLLMError.message);
    }
  }

  if (currentSchools && currentSchools.length > 0) {
    const sentences = discoveryMessageRaw.split(/(?<=[.!?])\s+/);
    const filteredSentences = sentences.filter(sentence => {
      for (const school of currentSchools) {
        const escapedName = school.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        if (regex.test(sentence)) return false;
      }
      return true;
    });
    discoveryMessageRaw = filteredSentences.join(' ').trim();
  }

  return {
    message: discoveryMessageRaw,
    state: STATES.DISCOVERY,
    briefStatus: null,
    familyProfile: conversationFamilyProfile,
    conversationContext: context,
    schools: []
  };
}

// Function: generateProfileNarrative
// Purpose: Generate AI narrative for ChatSession profile after edits
// Entities: ChatSession
// Last Modified: 2026-03-01
// Dependencies: OpenRouter API

import { ChatSession } from '@/lib/entities-server'
import { callOpenRouter } from './callOpenRouter'

export async function generateProfileNarrativeLogic(params: { sessionId: string; familyProfile: any }) {
  const { sessionId, familyProfile } = params;

  if (!sessionId || !familyProfile) {
    throw Object.assign(new Error('Missing sessionId or familyProfile'), { status: 400 });
  }

  // Generate narrative
  const { childName, childGrade, locationArea, maxTuition, priorities, learningDifferences, commuteToleranceMinutes } = familyProfile;

  const budgetDisplay = maxTuition ? `$${(maxTuition / 1000).toFixed(0)}K/year` : 'not specified';
  const prioritiesDisplay = priorities?.length > 0 ? priorities.join(', ') : 'none specified';
  const specialNeedsDisplay = learningDifferences?.length > 0 ? learningDifferences.join(', ') : 'none';
  const commuteDisplay = commuteToleranceMinutes ? `${commuteToleranceMinutes} minutes` : 'flexible';

  const narrativePrompt = `Write a 2-3 sentence narrative about this child for their School Search Profile. Be warm, professional, and personal. Reference the specific data provided.

Child: ${childName || 'Not named yet'}
Grade: ${childGrade !== null && childGrade !== undefined ? 'Grade ' + childGrade : 'not specified'}
Location: ${locationArea || 'not specified'}
Budget: ${budgetDisplay}
Priorities: ${prioritiesDisplay}
Special needs: ${specialNeedsDisplay}
Commute preference: ${commuteDisplay}`;

  let aiNarrative = await callOpenRouter({
    systemPrompt: 'You are a skilled education consultant writing warm, personalized school profile narratives. Keep it 2-3 sentences max.',
    userPrompt: narrativePrompt,
    maxTokens: 300,
    temperature: 0.7
  });

  // Update ChatSession with new narrative
  await ChatSession.update(sessionId, { aiNarrative });

  console.log('[generateProfileNarrative] Updated ChatSession narrative');

  return { success: true, narrative: aiNarrative };
}

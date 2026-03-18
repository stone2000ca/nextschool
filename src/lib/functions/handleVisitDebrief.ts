// @ts-nocheck
// Function: handleVisitDebrief
// Purpose: Handle visit debrief conversation flow after school tour
// Entities: GeneratedArtifact, School, FamilyJourney, SchoolJourney
// Last Modified: 2026-03-18
// Dependencies: callOpenRouter, processDebriefCompletion
// E13a: Visit debrief Q&A flow
// E29-006: Mark SchoolJourney as visited
// E29-014: Debrief sentiment analysis
// E29-015: Phase auto-advancement to DECIDE
// E13a-WC3: Fit re-evaluation after debrief complete

import { School, GeneratedArtifact, FamilyJourney, SchoolJourney } from '@/lib/entities-server'
import { callOpenRouter } from './callOpenRouter'
import { processDebriefCompletion as processDebriefCompletionLogic } from './processDebriefCompletion'

export async function handleVisitDebriefInternal(selectedSchoolId, processMessage, conversationFamilyProfile, context, consultantName, returningUserContextBlock) {
   if (!selectedSchoolId) return null;
   // NOTE: conversationId may be missing; artifact lookups will be guarded

  try {
    console.log('[E13a] Debrief mode active for school:', selectedSchoolId);

    // Load school and prior analysis (including deep_dive_analysis for fit re-evaluation)
    const schoolResults = await School.filter({ id: selectedSchoolId });
    let artifacts: any[] = [];
    let deepDiveArtifacts: any[] = [];
    if (context?.conversationId) {
      [artifacts, deepDiveArtifacts] = await Promise.all([
        GeneratedArtifact.filter({
          conversationId: context.conversationId,
          schoolId: selectedSchoolId,
          artifactType: 'visit_prep'
        }),
        GeneratedArtifact.filter({
          conversationId: context.conversationId,
          schoolId: selectedSchoolId,
          artifactType: 'deep_dive_analysis'
        })
      ]);
    }
    const school = schoolResults?.[0];
    const priorAnalysis = artifacts?.[0];
    const deepDiveAnalysis = deepDiveArtifacts?.[0];

    if (!school) return null;

    const schoolName = school.name;
    const childName = conversationFamilyProfile?.childName || 'your child';
    const priorVisitQuestions = priorAnalysis?.content?.visitQuestions || [];
    const priorTradeOffs = priorAnalysis?.content?.tradeOffs || [];

    // WC9: Initialize or refresh debrief question queue if switching schools
    const isNewDebrief = context.debriefSchoolId !== selectedSchoolId;
    let debriefQuestionQueue = context.debriefQuestionQueue || [];
    let debriefQuestionsAsked = context.debriefQuestionsAsked || [];

    const alreadyComplete = !isNewDebrief && debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length >= 3;
    if (alreadyComplete) {
      console.log('[E13a] Debrief already complete for this school, producing wrap-up');
      return {
        message: `Thank you for sharing your thoughts on ${school.name}. Your visit feedback has been noted and will help refine your school recommendations. Is there anything else you'd like to explore?`,
        state: "DEEP_DIVE",
        updatedContext: { debriefQuestionQueue: [], debriefQuestionsAsked, debriefSchoolId: selectedSchoolId }
      };
    }

    if (isNewDebrief || (debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length === 0)) {
      console.log('[E13a] Generating debrief question queue');
      debriefQuestionQueue = [];
      debriefQuestionsAsked = [];

      // Slot 0: Persona-generated opener
      const openerQ = consultantName === 'Jackie'
        ? 'How did it feel walking through the halls and seeing the spaces? What emotions came up?'
        : 'Did anything surprise you compared to what they advertise on their website or what you expected?';
      debriefQuestionQueue.push(openerQ);

      // Slots 1-2: Pull from VisitPrepKit or generate from priorities
      if (priorVisitQuestions.length > 0) {
        const q1 = typeof priorVisitQuestions[0] === 'string' ? priorVisitQuestions[0] : priorVisitQuestions[0]?.question;
        const q2 = priorVisitQuestions.length > 1 ? (typeof priorVisitQuestions[1] === 'string' ? priorVisitQuestions[1] : priorVisitQuestions[1]?.question) : null;
        if (q1) debriefQuestionQueue.push(q1);
        if (q2) debriefQuestionQueue.push(q2);
      } else {
        const priorities = conversationFamilyProfile?.priorities || [];
        if (priorities.length > 0) {
          debriefQuestionQueue.push(`How did they handle ${priorities[0]}? Did you see that reflected in the school?`);
        }
        if (priorities.length > 1) {
          debriefQuestionQueue.push(`What was your impression of their approach to ${priorities[1]}?`);
        }
      }

      // Ensure we always have 3 questions
      while (debriefQuestionQueue.length < 3) {
        debriefQuestionQueue.push('What was your overall impression?');
      }
    }

    // Pop next question if queue isn't empty
    let nextQuestion = '';
    if (debriefQuestionQueue.length > 0) {
      nextQuestion = debriefQuestionQueue.shift();
      debriefQuestionsAsked.push(nextQuestion);
    }

    const isDebriefComplete = debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length >= 3;
    const debriefQuestionsContext = `${nextQuestion ? `Next focus: "${nextQuestion}"` : 'Wrap up naturally — you\'ve asked your key questions.'}\n\nQuestions asked so far: ${debriefQuestionsAsked.length}/3`;

    // Build debrief prompt with persona-specific framing
    const basePrompt = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}You are ${consultantName}, an education consultant. The family just returned from visiting ${schoolName}.

${debriefQuestionsContext}`;

    const debriefSystemPrompt = consultantName === 'Jackie'
      ? `${basePrompt}

JACKIE TONE: Warm, empathetic, encouraging. Acknowledge their feelings and experiences before asking next question. Validate emotional responses. Help them feel heard.`
      : `${basePrompt}

LIAM TONE: Direct, analytical, practical. Acknowledge their observations factually before asking next question. Compare to expectations and data. Focus on fit assessment.`;

    const debriefUserPrompt = `Family just said: "${processMessage}"

${isDebriefComplete ? 'They\'ve shared their impressions. Wrap up warmly, validate their insights, and summarize what you heard.' : `Ask them: "${nextQuestion}"\n\nBe natural — don't sound robotic.`}`;

    let debriefMessage = "Tell me about your visit experience.";
    try {
      const debriefResponse = await callOpenRouter({
        systemPrompt: debriefSystemPrompt,
        userPrompt: debriefUserPrompt,
        maxTokens: 500,
        temperature: 0.7
      });
      debriefMessage = debriefResponse || "Tell me about your visit experience.";
    } catch (openrouterError) {
      try {
        const fallbackResponse = await Promise.race([
          callOpenRouter({
            prompt: debriefSystemPrompt + '\n\n' + debriefUserPrompt,
            model: 'gpt_5_mini'
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 8s')), 8000))
        ]);
        debriefMessage = fallbackResponse?.response || fallbackResponse || "Tell me about your visit experience.";
      } catch (fallbackError) {
        console.error('[E13a] Debrief response failed:', fallbackError.message);
      }
    }

    // WC9: Persist debrief Q&A pair (non-blocking)
    if (nextQuestion && context.userId && context.conversationId) {
      try {
        const newQAPair = {
          question: nextQuestion,
          answer: processMessage,
          timestamp: new Date().toISOString()
        };

        const existingArtifacts = await GeneratedArtifact.filter({
          conversationId: context.conversationId,
          schoolId: selectedSchoolId,
          artifactType: 'visit_debrief'
        });

        if (existingArtifacts && existingArtifacts.length > 0) {
          const artifact = existingArtifacts[0];
          const updatedQAPairs = (artifact.content?.qaPairs || []).concat([newQAPair]);
          await GeneratedArtifact.update(artifact.id, {
            content: { ...artifact.content, qaPairs: updatedQAPairs }
          });
          console.log('[E13a] Debrief Q&A appended to artifact:', artifact.id);
        } else {
          const created = await GeneratedArtifact.create({
            userId: context.userId,
            conversationId: context.conversationId,
            schoolId: selectedSchoolId,
            artifactType: 'visit_debrief',
            title: 'Visit Debrief - ' + schoolName,
            content: { qaPairs: [newQAPair], schoolName: schoolName },
            status: 'ready',
            isShared: false,
            pdfUrl: null,
            shareToken: null
          });
          console.log('[E13a] Debrief artifact created:', created.id);
        }
      } catch (persistError) {
        console.error('[E13a] Debrief persistence failed (non-blocking):', persistError.message);
      }
    }

    // E29-006: Fire-and-forget — mark SchoolJourney entity as visited on debrief completion
    if (isDebriefComplete && context.userId) {
      (async () => {
        try {
          const journeys = context.journeyId
            ? await FamilyJourney.filter({ id: context.journeyId })
            : await FamilyJourney.filter({ userId: context.userId }, '-updated_date', 1);
          const familyJourney = journeys?.[0];
          if (!familyJourney) return;

          const existing = await SchoolJourney.filter({
            familyJourneyId: familyJourney.id,
            schoolId: selectedSchoolId,
          });

          let sjId = null;
          if (existing && existing.length > 0) {
            await SchoolJourney.update(existing[0].id, { status: 'visited' });
            sjId = existing[0].id;
          } else {
            const created = await SchoolJourney.create({
              familyJourneyId: familyJourney.id,
              schoolId: selectedSchoolId,
              schoolName: school?.name || '',
              status: 'visited',
              addedAt: new Date().toISOString(),
            });
            sjId = created?.id;
          }
          console.log('[E29-006] SchoolJourney marked visited for', selectedSchoolId);

          // E29-014: Generate debrief summary + sentiment from Q&A pairs
          if (sjId && context.conversationId) {
            try {
              const debriefArtifacts = await GeneratedArtifact.filter({
                conversationId: context.conversationId,
                schoolId: selectedSchoolId,
                artifactType: 'visit_debrief'
              });
              const qaPairs = debriefArtifacts?.[0]?.content?.qaPairs || [];
              if (qaPairs.length > 0) {
                const qaText = qaPairs.map((qa, i) => `Q${i+1}: ${qa.question}\nA${i+1}: ${qa.answer}`).join('\n\n');
                const debriefAnalysis = await Promise.race([
                  callOpenRouter({
                    prompt: `A parent just completed a post-visit debrief for ${school?.name || 'a school'}. Analyze their responses and return JSON only.

Debrief Q&A:
${qaText}

Return ONLY this JSON (no markdown): { "debriefSummary": "<2-3 sentences summarizing what the parent observed and felt>", "debriefSentiment": "<POSITIVE|MIXED|NEGATIVE based on overall impression>" }`,
                    response_json_schema: {
                      type: 'object',
                      properties: {
                        debriefSummary: { type: 'string' },
                        debriefSentiment: { type: 'string', enum: ['POSITIVE', 'MIXED', 'NEGATIVE'] }
                      },
                      required: ['debriefSummary', 'debriefSentiment']
                    }
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('InvokeLLM timed out after 12s')), 12000))
                ]);
                const parsed = typeof debriefAnalysis === 'object' ? debriefAnalysis : JSON.parse(debriefAnalysis);
                if (parsed?.debriefSummary) {
                  await SchoolJourney.update(sjId, {
                    debriefSummary: parsed.debriefSummary,
                    debriefSentiment: parsed.debriefSentiment || 'MIXED'
                  });
                  console.log('[E29-014] SchoolJourney debrief summary stored, sentiment:', parsed.debriefSentiment);
                }
              }
            } catch (debriefErr) {
              console.error('[E29-014] Debrief summary generation failed:', debriefErr?.message);
            }
          }

          // E29-015: Phase auto-advancement → DECIDE if all non-removed schools are now visited
          try {
            const allSchoolJourneys = await SchoolJourney.filter({ familyJourneyId: familyJourney.id });
            const activeJourneys = allSchoolJourneys.filter(sj => sj.status !== 'removed');
            const allVisited = activeJourneys.length > 0 && activeJourneys.every(sj => sj.status === 'visited');
            if (allVisited && familyJourney.currentPhase !== 'DECIDE') {
              const currentHistory = Array.isArray(familyJourney.phaseHistory) ? familyJourney.phaseHistory : [];
              await FamilyJourney.update(familyJourney.id, {
                currentPhase: 'DECIDE',
                phaseHistory: [...currentHistory, { phase: 'DECIDE', enteredAt: new Date().toISOString() }],
              });
              console.log('[E29-015] FamilyJourney advanced to DECIDE — all schools visited');
            }
          } catch (phaseErr) {
            console.error('[E29-015] Phase advance to DECIDE failed:', phaseErr?.message);
          }
        } catch (e) {
          console.error('[E29-006] SchoolJourney visited sync failed:', e?.message || e);
        }
      })();
    }

    let reevalResult = null;
    // E13a-WC3: Fit re-evaluation after debrief complete (non-blocking)
    if (isDebriefComplete && context.userId) {
      await Promise.race([
        processDebriefCompletionLogic( {
          conversationId: context.conversationId,
          schoolId: selectedSchoolId,
          userId: context.userId,
          journeyId: context.journeyId,
          conversationFamilyProfile
        }).catch(e => console.error('[E29-010] Async debrief completion failed:', e.message)),
        new Promise(res => setTimeout(res, 500))
      ]);
    }

    return {
      message: debriefMessage,
      deepDiveMode: 'debrief',
      visitPrepKit: priorAnalysis?.content || null,
      fitReEvaluation: reevalResult || null,
      updatedContext: {
        debriefQuestionQueue,
        debriefQuestionsAsked,
        debriefSchoolId: selectedSchoolId
      }
    };
  } catch (e) {
    console.error('[E13a-S94] Debrief handling failed:', e.message);
    return null;
  }
}

// API route wrapper — accepts params object for backward compatibility
export async function handleVisitDebriefLogic(params: {
  selectedSchoolId: string;
  processMessage: string;
  conversationFamilyProfile: any;
  context: any;
  consultantName: string;
  returningUserContextBlock?: string;
  callOpenRouterFn?: (options: any) => Promise<any>;
}) {
  const { selectedSchoolId, processMessage, conversationFamilyProfile, context, consultantName, returningUserContextBlock } = params;
  return handleVisitDebriefInternal(selectedSchoolId, processMessage, conversationFamilyProfile, context, consultantName, returningUserContextBlock);
}

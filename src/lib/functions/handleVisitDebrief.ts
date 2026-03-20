// Function: handleVisitDebrief
// Purpose: Handle visit debrief conversation flow after school tour
// Entities: GeneratedArtifact, School, FamilyJourney
// Last Modified: 2026-03-02

import { School, GeneratedArtifact, FamilyJourney } from '@/lib/entities-server'

export async function handleVisitDebriefLogic(params: {
  selectedSchoolId: string;
  processMessage: string;
  conversationFamilyProfile: any;
  context: any;
  consultantName: string;
  returningUserContextBlock?: string;
  callOpenRouterFn: (options: any) => Promise<any>;
}) {
  const { selectedSchoolId, processMessage, conversationFamilyProfile, context, consultantName, returningUserContextBlock, callOpenRouterFn } = params;

  if (!selectedSchoolId || !context?.conversationId) return null;

  try {
    console.log('[E13a] Debrief mode active for school:', selectedSchoolId);

    const [schoolResults, artifacts, deepDiveArtifacts] = await Promise.all([
      School.filter({ id: selectedSchoolId }),
      GeneratedArtifact.filter({
        conversation_id: context.conversationId,
        school_id: selectedSchoolId,
        artifact_type: 'visit_prep'
      }),
      GeneratedArtifact.filter({
        conversation_id: context.conversationId,
        school_id: selectedSchoolId,
        artifact_type: 'deep_dive_analysis'
      })
    ]);
    const school = schoolResults?.[0];
    const priorAnalysis = artifacts?.[0];
    const deepDiveAnalysis = deepDiveArtifacts?.[0];

    if (!school) return null;

    const schoolName = school.name;
    const childName = conversationFamilyProfile?.child_name || 'your child';
    const priorVisitQuestions = priorAnalysis?.content?.visit_questions || priorAnalysis?.content?.visitQuestions || [];

    // WC9: Initialize or refresh debrief question queue
    const isNewDebrief = context.debriefSchoolId !== selectedSchoolId;
    let debriefQuestionQueue = context.debriefQuestionQueue || [];
    let debriefQuestionsAsked = context.debriefQuestionsAsked || [];

    if (isNewDebrief || debriefQuestionQueue.length === 0) {
      console.log('[E13a] Generating debrief question queue');
      debriefQuestionQueue = [];
      debriefQuestionsAsked = [];

      const openerQ = consultantName === 'Jackie'
        ? 'How did it feel walking through the halls and seeing the spaces? What emotions came up?'
        : 'Did anything surprise you compared to what they advertise on their website or what you expected?';
      debriefQuestionQueue.push(openerQ);

      if (priorVisitQuestions.length > 0) {
        const q1 = typeof priorVisitQuestions[0] === 'string' ? priorVisitQuestions[0] : priorVisitQuestions[0]?.question;
        const q2 = priorVisitQuestions.length > 1 ? (typeof priorVisitQuestions[1] === 'string' ? priorVisitQuestions[1] : priorVisitQuestions[1]?.question) : null;
        if (q1) debriefQuestionQueue.push(q1);
        if (q2) debriefQuestionQueue.push(q2);
      } else {
        const priorities = conversationFamilyProfile?.priorities || [];
        if (priorities.length > 0) debriefQuestionQueue.push(`How did they handle ${priorities[0]}? Did you see that reflected in the school?`);
        if (priorities.length > 1) debriefQuestionQueue.push(`What was your impression of their approach to ${priorities[1]}?`);
      }

      while (debriefQuestionQueue.length < 3) debriefQuestionQueue.push('What was your overall impression?');
    }

    let nextQuestion = '';
    if (debriefQuestionQueue.length > 0) {
      nextQuestion = debriefQuestionQueue.shift();
      debriefQuestionsAsked.push(nextQuestion);
    }

    const isDebriefComplete = debriefQuestionQueue.length === 0 && debriefQuestionsAsked.length >= 3;
    const debriefQuestionsContext = `${nextQuestion ? `Next focus: "${nextQuestion}"` : "Wrap up naturally — you've asked your key questions."}\n\nQuestions asked so far: ${debriefQuestionsAsked.length}/3`;

    const basePrompt = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}You are ${consultantName}, an education consultant. The family just returned from visiting ${schoolName}.

${debriefQuestionsContext}`;

    const debriefSystemPrompt = consultantName === 'Jackie'
      ? `${basePrompt}\n\nJACKIE TONE: Warm, empathetic, encouraging.`
      : `${basePrompt}\n\nLIAM TONE: Direct, analytical, practical.`;

    const debriefUserPrompt = `Family just said: "${processMessage}"

${isDebriefComplete ? 'They\'ve shared their impressions. Wrap up warmly, validate their insights, and summarize what you heard.' : `Ask them: "${nextQuestion}"\n\nBe natural — don't sound robotic.`}`;

    let debriefMessage = "Tell me about your visit experience.";
    try {
      const debriefResponse = await callOpenRouterFn({
        systemPrompt: debriefSystemPrompt,
        userPrompt: debriefUserPrompt,
        maxTokens: 500,
        temperature: 0.7
      });
      debriefMessage = debriefResponse || "Tell me about your visit experience.";
    } catch (openrouterError: any) {
      console.error('[E13a] Debrief response failed:', openrouterError.message);
    }

    // WC9: Persist debrief Q&A pair (non-blocking)
    if (nextQuestion && context.userId) {
      const newQAPair = { question: nextQuestion, answer: processMessage, timestamp: new Date().toISOString() };

      GeneratedArtifact.filter({
        conversation_id: context.conversationId,
        school_id: selectedSchoolId,
        artifact_type: 'visit_debrief'
      }).then(async (existingArtifacts: any[]) => {
        if (existingArtifacts && existingArtifacts.length > 0) {
          const artifact = existingArtifacts[0];
          const updatedQAPairs = (artifact.content?.qaPairs || []).concat([newQAPair]);
          await GeneratedArtifact.update(artifact.id, { content: { ...artifact.content, qaPairs: updatedQAPairs } });
        } else {
          await GeneratedArtifact.create({
            user_id: context.userId,
            conversation_id: context.conversationId,
            school_id: selectedSchoolId,
            artifact_type: 'visit_debrief',
            title: 'Visit Debrief - ' + schoolName,
            content: { qaPairs: [newQAPair], schoolName },
            status: 'ready',
            is_shared: false,
            pdf_url: null,
            share_token: null
          });
        }
      }).catch((e: any) => console.error('[E13a] Debrief persistence failed:', e.message));
    }

    // E13a-WC3: Fit re-evaluation after debrief complete (non-blocking)
    if (isDebriefComplete && deepDiveAnalysis && context.userId) {
      (async () => {
        try {
          const debriefArtifacts = await GeneratedArtifact.filter({ conversation_id: context.conversationId, school_id: selectedSchoolId, artifact_type: 'visit_debrief' });
          const debriefArtifact = debriefArtifacts?.[0];
          if (!debriefArtifact?.content?.qaPairs?.length) return;

          // Sync to FamilyJourney
          const journey = context.journeyId
            ? (await FamilyJourney.filter({ id: context.journeyId }))?.[0]
            : (await FamilyJourney.filter({ user_id: context.userId }))?.[0];

          if (journey) {
            const schoolJourneys = Array.isArray(journey.school_journeys) ? [...journey.school_journeys] : [];
            let item = schoolJourneys.find((sj: any) => sj.schoolId === selectedSchoolId);
            const nowIso = new Date().toISOString();
            if (item) {
              item.status = 'VISITED';
              item.visitedAt = nowIso;
              item.debriefCompletedAt = nowIso;
            } else {
              schoolJourneys.push({ schoolId: selectedSchoolId, schoolName, status: 'VISITED', addedVia: 'DEBRIEF', visitedAt: nowIso, debriefCompletedAt: nowIso });
            }
            const hasTouring = schoolJourneys.some((sj: any) => sj.status === 'TOURING');
            const updatePayload: any = { school_journeys: schoolJourneys };
            if (!hasTouring && journey.current_phase === 'EXPERIENCE') updatePayload.current_phase = 'DECIDE';
            await FamilyJourney.update(journey.id, updatePayload);
          }

          // Fit re-evaluation via LLM
          const originalAnalysis = deepDiveAnalysis.content || {};
          const qaPairs = debriefArtifact.content.qaPairs;
          const qaContext = qaPairs.map((qa: any, idx: number) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`).join('\n\n');

          const reevalResult = await callOpenRouterFn({
            systemPrompt: 'You are a school fit analyst. Return ONLY valid JSON.',
            userPrompt: `ORIGINAL ANALYSIS:\n- Fit Label: ${originalAnalysis.fit_label || originalAnalysis.fitLabel || 'unknown'}\n\nPOST-VISIT DEBRIEF:\n${qaContext}\n\nProvide fit re-evaluation as JSON: { updated_fit_label, fit_direction, revised_strengths, revised_concerns, visit_verdict }`,
            maxTokens: 600,
            temperature: 0.5,
            responseSchema: { name: 'fit_reevaluation', schema: { type: 'object', properties: { updated_fit_label: { type: 'string' }, fit_direction: { type: 'string' }, revised_strengths: { type: 'array', items: { type: 'string' } }, revised_concerns: { type: 'array', items: { type: 'string' } }, visit_verdict: { type: 'string' } }, required: ['updated_fit_label', 'fit_direction', 'revised_strengths', 'revised_concerns', 'visit_verdict'], additionalProperties: false } }
          });

          if (reevalResult) {
            await GeneratedArtifact.create({ user_id: context.userId, conversation_id: context.conversationId, school_id: selectedSchoolId, artifact_type: 'fit_reevaluation', title: 'Fit Re-evaluation - ' + schoolName, content: { ...reevalResult, original_fit_label: originalAnalysis.fit_label || originalAnalysis.fitLabel || 'unknown', debriefTimestamp: new Date().toISOString() }, status: 'ready', is_shared: false, pdf_url: null, share_token: null });

            if (journey) {
              const sjs = Array.isArray(journey.school_journeys) ? [...journey.school_journeys] : [];
              const sjItem = sjs.find((sj: any) => sj.schoolId === selectedSchoolId);
              if (sjItem) {
                sjItem.postVisitFitLabel = reevalResult.updated_fit_label;
                sjItem.fitDirection = reevalResult.fit_direction;
                sjItem.visitVerdict = reevalResult.visit_verdict;
                sjItem.revisedStrengths = reevalResult.revised_strengths;
                sjItem.revisedConcerns = reevalResult.revised_concerns;
              }
              await FamilyJourney.update(journey.id, { school_journeys: sjs });
            }
          }
        } catch (e: any) {
          console.error('[E13a-WC3] Fit re-evaluation failed:', e.message);
        }
      })();
    }

    return {
      message: debriefMessage,
      deepDiveMode: 'debrief',
      visitPrepKit: priorAnalysis?.content || null,
      updatedContext: {
        debriefQuestionQueue,
        debriefQuestionsAsked,
        debriefSchoolId: selectedSchoolId
      }
    };
  } catch (e: any) {
    console.error('[E13a] Debrief handling failed:', e.message);
    return null;
  }
}

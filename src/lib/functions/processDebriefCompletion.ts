import { ConversationArtifacts, FamilyJourney } from '@/lib/entities-server'
import { invokeLLM } from '@/lib/integrations'

export async function processDebriefCompletion(params: {
  conversationId: string
  schoolId: string
  userId: string
  journeyId?: string
  conversationFamilyProfile?: any
}) {
  const { conversationId, schoolId, userId, journeyId, conversationFamilyProfile } = params;

  if (!conversationId || !schoolId || !userId) {
    throw Object.assign(new Error('[E29-010] Missing required params'), { statusCode: 400 });
  }

  // 1) Load artifacts (visit_debrief and deep_dive_analysis)
  const [debriefArtifacts, deepDiveArtifacts] = await Promise.all([
    ConversationArtifacts.filter({
      conversation_id: conversationId,
      school_id: schoolId,
      artifact_type: 'visit_debrief',
    }),
    ConversationArtifacts.filter({
      conversation_id: conversationId,
      school_id: schoolId,
      artifact_type: 'deep_dive_analysis',
    }),
  ]);
  const debriefArtifact = (debriefArtifacts as any)?.[0] || null;
  const deepDiveAnalysis = (deepDiveArtifacts as any)?.[0] || null;

  // 2) Load FamilyJourney by id or userId
  const journey =
    (journeyId && (await FamilyJourney.filter({ id: journeyId }))?.[0]) ||
    (await FamilyJourney.filter({ user_id: userId }))?.[0] ||
    null;

  if (!journey) {
    console.warn('[E29-010] No FamilyJourney found; skipping journey updates');
  }

  // 3) Find/create schoolJourney entry; set VISITED + timestamps
  let currentPhase = (journey as any)?.current_phase || null;
  const nowIso = new Date().toISOString();
  let schoolJourneys: any[] = Array.isArray((journey as any)?.school_journeys) ? [...(journey as any).school_journeys] : [];
  let item = schoolJourneys.find((sj: any) => sj.schoolId === schoolId);

  if (item) {
    item.status = 'VISITED';
    item.visitedAt = nowIso;
    item.debriefCompletedAt = nowIso;
    if (debriefArtifact?.id) item.debriefArtifactId = debriefArtifact.id;
  } else if (journey) {
    schoolJourneys.push({
      schoolId,
      schoolName: '', // optional; can be filled elsewhere
      status: 'VISITED',
      addedVia: 'DEBRIEF',
      visitedAt: nowIso,
      debriefCompletedAt: nowIso,
      debriefArtifactId: debriefArtifact?.id || undefined,
    });
  }

  // 4) Fit re-eval via InvokeLLM with response_json_schema (structured)
  let reevalResult: any = null;
  try {
    if (debriefArtifact?.content?.qaPairs?.length && deepDiveAnalysis?.content) {
      const originalAnalysis = deepDiveAnalysis.content || {};
      const qaPairs = debriefArtifact.content.qaPairs || [];
      const priorities = conversationFamilyProfile?.priorities || [];

      const qaContext = qaPairs
        .map((qa: any, idx: number) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`)
        .join('\n\n');

      const reevalSystemPrompt = `You are a school fit analyst. Given original school analysis and post-visit debrief responses, re-evaluate whether the school remains a good fit.

CRITICAL: Return ONLY valid JSON. Do NOT include any markdown code blocks, explanations, or text outside the JSON.`;

      const reevalUserPrompt = `ORIGINAL ANALYSIS:
- Fit Label: ${originalAnalysis.fit_label || originalAnalysis.fitLabel || 'unknown'}
- Trade-offs: ${(originalAnalysis.trade_offs || originalAnalysis.tradeOffs || []).map((t: any) => `${t.dimension}: ${t.concern || 'neutral'}`).join('; ') || 'none'}
- Strengths: ${(originalAnalysis.strengths || []).join(', ') || 'none noted'}

FAMILY PRIORITIES: ${priorities.join(', ') || 'not specified'}

POST-VISIT DEBRIEF Q&A:
${qaContext}

Based on what the family shared during their visit, provide a fit re-evaluation. Return JSON: { updated_fit_label (enum: "strong_match", "good_match", "worth_exploring"), fit_direction (enum: "improved", "declined", "unchanged"), revised_strengths (array of strings), revised_concerns (array of strings), visit_verdict (string, 1-2 sentences) }`;

      const structured = await invokeLLM({
        prompt: `${reevalSystemPrompt}\n\n${reevalUserPrompt}`,
        response_json_schema: {
          type: 'object',
          properties: {
            updated_fit_label: { type: 'string', enum: ['strong_match', 'good_match', 'worth_exploring'] },
            fit_direction: { type: 'string', enum: ['improved', 'declined', 'unchanged'] },
            revised_strengths: { type: 'array', items: { type: 'string' } },
            revised_concerns: { type: 'array', items: { type: 'string' } },
            visit_verdict: { type: 'string' },
          },
          required: ['updated_fit_label', 'fit_direction', 'revised_strengths', 'revised_concerns', 'visit_verdict'],
          additionalProperties: false,
        },
      });

      reevalResult = structured || null;

      // 5) Create fit_reevaluation artifact
      if (reevalResult) {
        const fitReevalContent = {
          ...reevalResult,
          original_fit_label: originalAnalysis.fit_label || originalAnalysis.fitLabel || 'unknown',
          debriefTimestamp: nowIso,
        };

        await ConversationArtifacts.create({
          user_id: userId,
          conversation_id: conversationId,
          school_id: schoolId,
          artifact_type: 'fit_reevaluation',
          title: 'Fit Re-evaluation',
          content: fitReevalContent,
          status: 'ready',
          is_shared: false,
          pdf_url: null,
          share_token: null,
        });
      }
    } else {
      console.log('[E29-010] Skipping fit re-eval: missing debrief QA pairs or deepDiveAnalysis');
    }
  } catch (e: any) {
    console.error('[E29-010] Fit re-eval failed:', e?.message || e);
  }

  // 6) Patch schoolJourney with re-eval fields (if we got them)
  if (reevalResult && item) {
    item.postVisitFitLabel = reevalResult.updated_fit_label;
    item.fitDirection = reevalResult.fit_direction;
    item.visitVerdict = reevalResult.visit_verdict;
    item.revisedStrengths = reevalResult.revised_strengths;
    item.revisedConcerns = reevalResult.revised_concerns;
  }

  // 7) Phase advance: if all TOURING items now VISITED and phase is EXPERIENCE -> DECIDE
  let nextPhase: string | null = null;
  if (journey) {
    const hasTouring = schoolJourneys.some((sj: any) => sj.status === 'TOURING');
    if (!hasTouring && currentPhase === 'EXPERIENCE') {
      nextPhase = 'DECIDE';
    }
    const updatePayload: any = { school_journeys: schoolJourneys };
    if (nextPhase) updatePayload.current_phase = nextPhase;
    await FamilyJourney.update((journey as any).id, updatePayload);
  }

  return { ok: true };
}

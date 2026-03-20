// Function: handleDeepDive
// Purpose: Handle deep-dive school analysis with visit prep generation and debrief mode routing
// Entities: School, SchoolAnalysis, GeneratedArtifact, SchoolEvent, User, Testimonial
// Last Modified: 2026-03-09

import { School, SchoolAnalysis, GeneratedArtifact, SchoolEvent, User, Testimonial, LLMLog } from '@/lib/entities-server'

// =============================================================================
// INLINED: callOpenRouter
// =============================================================================
async function callOpenRouter(options: any) {
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.7, _logContext, tools, toolChoice, returnRaw = false } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];
  const body: any = { models, messages, max_tokens: maxTokens, temperature };

  if (tools && tools.length > 0) { body.tools = tools; body.tool_choice = toolChoice || 'auto'; }

  if (responseSchema) {
    body.response_format = { type: 'json_schema', json_schema: { name: responseSchema.name || 'response', strict: true, schema: responseSchema.schema } };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const TIMEOUT_MS = 12000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://nextschool.ca', 'X-OpenRouter-Title': 'NextSchool' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (!content && toolCalls.length === 0) throw new Error('OpenRouter returned empty content');

    if (responseSchema) {
      try { return JSON.parse(content); } catch (e) {
        console.error('[OPENROUTER] JSON parse failed, returning raw content');
        return content;
      }
    }

    if (returnRaw) return { content: content || '', toolCalls };
    return content;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    throw err;
  }
}

function extractConciseSummary(fullProse: string) {
  const sentences = fullProse.split(/(?<=[.!?])\s+/);
  const meaningful = sentences.filter((s: string) => s.trim().length > 0);
  if (meaningful.length < 2) return fullProse;
  const concise = meaningful.slice(0, 3).join(' ');
  return concise + " I've saved the full breakdown to your shortlist — tap the heart to see everything.";
}

const MERGED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['ADD_TO_SHORTLIST', 'OPEN_PANEL', 'EXPAND_SCHOOL'] }, schoolId: { type: 'string' }, panel: { type: 'string', enum: ['shortlist', 'comparison', 'brief'] } }, required: ['type'] } },
    school_analysis: {
      type: 'object',
      properties: {
        fit_label: { type: 'string', enum: ['strong_match', 'good_match', 'worth_exploring'] },
        fit_score: { type: 'number' },
        trade_offs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['dimension', 'strength', 'concern', 'data_source'], properties: { dimension: { type: 'string' }, strength: { type: 'string' }, concern: { type: 'string' }, data_source: { type: 'string' } } } },
        data_gaps: { type: 'array', items: { type: 'string' } },
        visit_questions: { type: 'array', items: { type: 'string' } },
        financial_summary: { type: 'object', additionalProperties: false, required: ['tuition', 'aid_available', 'estimated_net_cost', 'budget_fit'], properties: { tuition: { type: 'number' }, aid_available: { type: 'boolean' }, estimated_net_cost: { type: 'number' }, budget_fit: { type: 'string' } } },
        ai_insight: { type: 'string' },
        priority_matches: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['priority', 'status', 'detail'], properties: { priority: { type: 'string' }, status: { type: 'string', enum: ['match', 'partial', 'flag'] }, detail: { type: 'string' } } } },
        community_pulse: { type: 'object', additionalProperties: false, required: ['review_count', 'themes', 'sentiment_breakdown', 'parent_perspective'], properties: { review_count: { type: 'number' }, themes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'sentiment'], properties: { label: { type: 'string' }, sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] } } } }, sentiment_breakdown: { type: 'object', additionalProperties: false, required: ['positive', 'neutral', 'negative'], properties: { positive: { type: 'number' }, neutral: { type: 'number' }, negative: { type: 'number' } } }, parent_perspective: { type: 'string' } } }
      },
      required: ['fit_label', 'fit_score', 'trade_offs', 'data_gaps', 'visit_questions', 'financial_summary', 'ai_insight']
    }
  },
  required: ['message', 'actions', 'school_analysis']
};

export async function handleDeepDiveLogic(params: any) {
  const { selectedSchoolId, message, conversationFamilyProfile, context, conversationHistory, consultantName, currentState, briefStatus, currentSchools, userId, returningUserContextBlock, flags, conversationId } = params;

  const STATES = { WELCOME: 'WELCOME', DISCOVERY: 'DISCOVERY', BRIEF: 'BRIEF', RESULTS: 'RESULTS', DEEP_DIVE: 'DEEP_DIVE' };

  // Back-to-results detection
  const backToResultsPattern = /\b(what about another|show me other|different school|go back|other options|other schools|what else|see other|back to results|show me more|look at other|compare other|other matches|show other|different one|another school)\b/i;
  if (backToResultsPattern.test(message)) {
    return { message: "Of course! Here are your school matches — click any card to explore it in detail.", state: STATES.RESULTS, briefStatus, schools: currentSchools || [], familyProfile: conversationFamilyProfile, conversationContext: context, rawToolCalls: [] };
  }

  // Tour booking detection
  const TOUR_BOOKING_RE = /\b(book|schedule|arrange|request|sign\s*up\s*for|register\s*for|set\s*up)\b.{0,30}\b(tour|visit|open\s*house|campus\s*visit|info\s*session)\b|\b(want\s+to|like\s+to|ready\s+to)\s+(visit|tour|see|check\s*out)\b/i;
  if (TOUR_BOOKING_RE.test(message) && selectedSchoolId) {
    return { message: `Great — let me pull up the tour request form for that school.`, state: STATES.DEEP_DIVE, briefStatus, schools: currentSchools || [], familyProfile: conversationFamilyProfile, conversationContext: context, actions: [{ type: 'INITIATE_TOUR', payload: { schoolId: selectedSchoolId }, timing: 'immediate' }], rawToolCalls: [] };
  }

  console.log('[DEEPDIVE_START]', selectedSchoolId);
  let aiMessage = '';

  // Parallel DB calls
  const [userRecords, schoolResults, [cachedRec, cachedPrep, cachedPlan], allEvents, testimonials] = await Promise.all([
    userId ? User.filter({ id: userId }).catch(() => []) : Promise.resolve([]),
    selectedSchoolId ? School.filter({ id: selectedSchoolId }).catch(() => []) : Promise.resolve([]),
    (userId && selectedSchoolId) ? Promise.all([
      GeneratedArtifact.filter({ user_id: userId, school_id: selectedSchoolId, artifact_type: 'deep_dive_recommendation' }),
      GeneratedArtifact.filter({ user_id: userId, school_id: selectedSchoolId, artifact_type: 'visit_prep_kit' }),
      GeneratedArtifact.filter({ user_id: userId, school_id: selectedSchoolId, artifact_type: 'action_plan' })
    ]).catch(() => [[], [], []]) : Promise.resolve([[], [], []]),
    selectedSchoolId ? SchoolEvent.filter({ school_id: selectedSchoolId, is_active: true }).catch(() => []) : Promise.resolve([]),
    selectedSchoolId ? Testimonial.filter({ school_id: selectedSchoolId, is_visible: true }).catch(() => []) : Promise.resolve([])
  ]);

  const userTier = (userRecords as any)?.[0]?.tier || 'free';
  const isPremiumUser = userTier === 'premium';

  let selectedSchool = (schoolResults as any)?.[0] || null;
  if (!selectedSchool) {
    return { message: "I couldn't load that school's details. Please try selecting it again.", state: currentState, briefStatus, schools: currentSchools || [], familyProfile: conversationFamilyProfile, conversationContext: context, rawToolCalls: [] };
  }

  // Cache check
  if (userId && selectedSchoolId) {
    const rec = (cachedRec as any)?.[0];
    const prep = (cachedPrep as any)?.[0];
    const plan = (cachedPlan as any)?.[0];
    const allCached = rec?.metadata?.version === 'E30_V1' && prep?.metadata?.version === 'E30_V1' && plan?.metadata?.version === 'E30_V1';
    if (allCached) {
      console.log('[E30] Cache hit — returning from cache for school:', selectedSchoolId);
      let cachedVisitPrepKit: any = null;
      try {
        const fullKit = typeof prep.content === 'string' ? JSON.parse(prep.content) : prep.content;
        cachedVisitPrepKit = isPremiumUser ? fullKit : { schoolName: fullKit.schoolName, intro: fullKit.intro, visitQuestions: (fullKit.visitQuestions || fullKit.visit_questions || []).slice(0, 2), observations: null, redFlags: null, isLocked: true };
      } catch (e) {}
      let cachedActionPlan: any = null;
      try { cachedActionPlan = isPremiumUser ? (typeof plan.content === 'string' ? JSON.parse(plan.content) : plan.content) : null; } catch (e) {}
      let cachedDeepDiveAnalysis: any = null;
      try {
        const saFilter: any = { user_id: userId, school_id: selectedSchoolId };
        if (conversationId) saFilter.conversation_id = conversationId;
        const analyses = await SchoolAnalysis.filter(saFilter);
        if (analyses?.[0]) cachedDeepDiveAnalysis = analyses[0];
      } catch (e) {}
      const isPremiumSchool = selectedSchool.school_tier === 'growth' || selectedSchool.school_tier === 'pro';
      return { message: extractConciseSummary(rec.content), state: currentState, briefStatus, schools: currentSchools || [], familyProfile: conversationFamilyProfile, conversationContext: { ...(context || {}), [`deepDiveFollowUpShown_${selectedSchoolId}`]: true }, deepDiveAnalysis: cachedDeepDiveAnalysis, visitPrepKit: cachedVisitPrepKit, actionPlan: cachedActionPlan, tourRequestOffered: isPremiumSchool, fromCache: true, rawToolCalls: [] };
    }
  }

  // Build school data for LLM
  const childDisplayName = conversationFamilyProfile?.child_name || 'your child';
  const resolvedMaxTuition = conversationFamilyProfile?.max_tuition ? (typeof conversationFamilyProfile.max_tuition === 'number' ? conversationFamilyProfile.max_tuition : parseInt(conversationFamilyProfile.max_tuition)) : null;
  const resolvedPriorities = conversationFamilyProfile?.priorities?.length > 0 ? conversationFamilyProfile.priorities : null;

  const compressedSchoolData = {
    name: selectedSchool.name,
    tuitionFee: selectedSchool.tuition || selectedSchool.day_tuition || 'Not specified',
    location: `${selectedSchool.city}, ${selectedSchool.province_state || selectedSchool.country}`,
    genderPolicy: selectedSchool.gender_policy || 'Co-ed',
    curriculum: selectedSchool.curriculum || null,
    specializations: selectedSchool.specializations || [],
    avgClassSize: selectedSchool.avg_class_size || null,
    studentTeacherRatio: selectedSchool.student_teacher_ratio || null,
    sportsPrograms: selectedSchool.sports_programs?.slice(0, 5) || [],
    artsPrograms: selectedSchool.arts_programs?.slice(0, 5) || [],
    boardingAvailable: !!(selectedSchool.boarding_tuition || selectedSchool.boarding_available),
    financialAidAvailable: selectedSchool.financial_aid_available || false,
    faithBased: selectedSchool.faith_based || null,
    enrollment: selectedSchool.enrollment || null,
    description: selectedSchool.description?.substring(0, 300) || null
  };

  // Filter upcoming events
  let upcomingEvents: any[] = [];
  try {
    const now = new Date();
    upcomingEvents = ((allEvents as any) || []).filter((e: any) => e.date && new Date(e.date).getTime() >= now.getTime()).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  } catch (e) {}

  // Build event context
  const subscriptionTier = selectedSchool.subscription_tier || 'free';
  const schoolContactEmail = selectedSchool.email || null;
  let eventContext = '';
  if (upcomingEvents.length > 0) {
    const eventLines = upcomingEvents.map((e: any) => {
      const confidenceTag = (e.is_confirmed === true) ? '[confirmed]' : '[estimated — verify with school]';
      const dateStr = new Date(e.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const typeLabel = (e.event_type || '').replace(/_/g, ' ');
      const regUrl = e.registration_url ? ` | Register: ${e.registration_url}` : '';
      return `- ${e.title || typeLabel} (${typeLabel}) — ${dateStr} ${confidenceTag}${regUrl}`;
    });
    eventContext = `UPCOMING EVENTS (${upcomingEvents.length} found):\n${eventLines.join('\n')}`;
  } else {
    eventContext = `UPCOMING EVENTS: None found in our system.`;
  }

  const schoolIdContext = selectedSchoolId && selectedSchool
    ? `\nSCHOOL IDs (use these exact IDs in execute_ui_action):\n[ID:${selectedSchoolId}] ${selectedSchool.name}`
    : '';

  const area4Instructions = `
AREA 4 — EVENT-AWARE NEXT STEP (include naturally at the end of your response):
${upcomingEvents.length > 0
  ? `There are upcoming events at this school. Mention the nearest one naturally. Use the confidence tag to set expectations.${subscriptionTier === 'premium' ? ` This school is a premium partner — you may also offer to send a tour request on the parent's behalf.` : ''}`
  : `No upcoming events are in our system. Clearly say you don't have event dates on file, and suggest contacting admissions directly.${schoolContactEmail ? ` Admissions contact: ${schoolContactEmail}.` : ''}`
}
${schoolIdContext}`;

  const deepDiveSystemPrompt = `${returningUserContextBlock ? returningUserContextBlock + '\n\n' : ''}You are ${consultantName}, an education consultant. The parent is currently in a deep-dive on a specific school.

CRITICAL STATE RULE:
If the parent updates any preference mid-conversation, acknowledge in ONE short sentence only. STOP. NEVER mention a "Refresh Matches" button. Do NOT produce numbered preference lists or confirmation questions.

${consultantName === 'Jackie' ? "JACKIE PERSONA: Warm, empathetic, supportive." : "LIAM PERSONA: Direct, strategic, no-BS."}

Write naturally in conversational prose about why this school fits the family. Cover the student-school alignment (including how programs match child interests, how the learning environment suits their personality and learning style, and whether the school can support any academic struggles or learning differences), any trade-offs or concerns, and the cost reality. Speak like a consultant would — no headers, labels, or formatting markers. End with a brief, clear sentence summarizing whether this school is a strong fit and the primary reason why or why not.
${area4Instructions}

STRUCTURED ANALYSIS INSTRUCTIONS:
In your JSON response, also include a school_analysis object with:
- fit_label: 'strong_match', 'good_match', or 'worth_exploring'
- fit_score: 0-100 numeric score
- trade_offs: array of {dimension, strength, concern, data_source} - MUST have at least 3 items
- data_gaps: array of field names with missing data relevant to this family
- visit_questions: array of 3-5 personalized questions for a school visit
- financial_summary: {tuition (number), aid_available (boolean), estimated_net_cost (number), budget_fit (string)}
- ai_insight: 2-3 sentence summary insight about this school-family match
- priority_matches: For each priority from the family Brief, assess fit with status 'match', 'partial', or 'flag'
- community_pulse: {review_count, themes (3-5 items with sentiment), sentiment_breakdown, parent_perspective}`;

  const deepDiveUserPrompt = `FAMILY BRIEF:
- Child: ${childDisplayName}
- Budget: ${resolvedMaxTuition ? '$' + resolvedMaxTuition : 'Not specified'}
- Priorities: ${resolvedPriorities?.join(', ') || 'Not specified'}
- Interests: ${conversationFamilyProfile?.interests?.join(', ') || 'Not specified'}
- Academic Strengths: ${conversationFamilyProfile?.academic_strengths?.join(', ') || 'Not specified'}
- Academic Struggles: ${conversationFamilyProfile?.academic_struggles?.join(', ') || 'Not specified'}
- Learning Style: ${conversationFamilyProfile?.learning_style || 'Not specified'}
- Personality Traits: ${conversationFamilyProfile?.personality_traits?.join(', ') || 'Not specified'}
- Learning Differences: ${conversationFamilyProfile?.learning_differences?.join(', ') || 'None noted'}

SCHOOL DATA:
${JSON.stringify(compressedSchoolData, null, 2)}

SCHOOL SUBSCRIPTION TIER: ${subscriptionTier}

${eventContext}

${(testimonials as any)?.length > 0 ? `PARENT TESTIMONIALS (${(testimonials as any).length} reviews):
${(testimonials as any).map((t: any) => `"${t.quote_text}" — ${t.author_role}${t.year ? ` (${t.year})` : ''}`).join('\n')}` : 'PARENT TESTIMONIALS: None available for this school.'}

Generate the DEEPDIVE card for this family-school match.`;

  let deepDiveAnalysis: any = null;
  const rawToolCalls: any[] = [];

  try {
    const aiResponse = await callOpenRouter({
      systemPrompt: deepDiveSystemPrompt,
      userPrompt: deepDiveUserPrompt,
      maxTokens: 2000,
      temperature: 0.6,
      responseSchema: { name: 'merged_response', schema: MERGED_RESPONSE_SCHEMA }
    });

    if (aiResponse) {
      const parsed = typeof aiResponse === 'object' ? aiResponse : JSON.parse(aiResponse);
      aiMessage = parsed.message || '';
      if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
        rawToolCalls.push({ function: { name: 'execute_ui_action', arguments: JSON.stringify({ actions: parsed.actions }) } });
      }
      deepDiveAnalysis = parsed.school_analysis || { fit_label: 'worth_exploring', fit_score: 50, trade_offs: [], data_gaps: [], visit_questions: [], financial_summary: null, ai_insight: '', priority_matches: [], community_pulse: null };
    }
  } catch (openrouterError: any) {
    console.error('[DEEPDIVE] OpenRouter failed:', openrouterError.message);
    aiMessage = `**Great Fit for ${childDisplayName}**\n\n${selectedSchool.description?.substring(0, 150) || 'School details available upon request.'}\n\nWhat would you like to know more about?`;
    deepDiveAnalysis = { fit_label: 'worth_exploring', fit_score: 50, trade_offs: [], data_gaps: [], visit_questions: [], financial_summary: null, ai_insight: '', priority_matches: [], community_pulse: null };
  }

  // Save to SchoolAnalysis
  if (userId && selectedSchoolId && deepDiveAnalysis) {
    try {
      const persistFilter: any = { user_id: userId, school_id: selectedSchoolId };
      if (conversationId) persistFilter.conversation_id = conversationId;
      const existing = await SchoolAnalysis.filter(persistFilter);
      if (existing?.length > 0) {
        await SchoolAnalysis.update(existing[0].id, { ...deepDiveAnalysis, school_name: selectedSchool.name, last_analyzed_at: new Date().toISOString(), conversation_id: conversationId || null });
      } else {
        await SchoolAnalysis.create({ user_id: userId, school_id: selectedSchoolId, school_name: selectedSchool.name, ...deepDiveAnalysis, last_analyzed_at: new Date().toISOString(), conversation_id: conversationId || null });
        const childName = conversationFamilyProfile?.child_name || null;
        const schoolName = selectedSchool.name;
        if (consultantName === 'Jackie') {
          aiMessage += `\n\nBy the way — I can put together a personalized Visit Prep Kit for ${schoolName}. Want me to prepare that?`;
        } else {
          aiMessage += `\n\nI can prepare a Visit Prep Kit for ${schoolName}. Want me to put that together?`;
        }
      }
    } catch (e: any) { console.warn('[DEEPDIVE] SchoolAnalysis persist failed:', e.message); }
  }

  const sanitizedMessage = aiMessage.split('\n').filter((line: string) => !/^(DEEPDIVE Card:|Fit Label|Why This School|What to Know|Cost Reality|Dealbreaker Check|Tone Bridge)/.test(line.trim())).join('\n').trim();

  // Generate visitPrepKit
  let generatedVisitPrepKit: any = null;
  let fullVisitPrepKit: any = null;
  if (deepDiveAnalysis && selectedSchool) {
    fullVisitPrepKit = {
      schoolName: selectedSchool.name,
      visitQuestions: (deepDiveAnalysis.visit_questions || []).map((q: string) => ({ question: q, priorityTag: 'medium' })),
      observations: (deepDiveAnalysis.data_gaps || []).map((gap: string) => `Observe how the school addresses: ${gap}`),
      redFlags: (deepDiveAnalysis.trade_offs || []).filter((t: any) => t.concern).map((t: any) => `Watch for concerns around ${t.dimension}.`),
      intro: `Here's your personalized Visit Prep Kit for ${selectedSchool.name}.`,
      isLocked: false
    };

    if (!isPremiumUser) {
      generatedVisitPrepKit = { schoolName: fullVisitPrepKit.schoolName, intro: fullVisitPrepKit.intro, visitQuestions: fullVisitPrepKit.visitQuestions.slice(0, 2), observations: null, redFlags: null, isLocked: true };
    } else {
      generatedVisitPrepKit = fullVisitPrepKit;
    }
  }

  // Generate action plan
  let generatedActionPlan: any = null;
  if (deepDiveAnalysis && selectedSchool && userId) {
    const visitWindow = upcomingEvents.length > 0
      ? { recommendedAction: `Attend ${upcomingEvents[0].title} on ${new Date(upcomingEvents[0].date).toLocaleDateString('en-CA')}`, events: upcomingEvents.map((e: any) => ({ title: e.title, date: e.date, type: e.event_type })) }
      : { recommendedAction: 'Contact admissions to schedule a campus tour', events: [] };

    const docChecklist = [
      { item: 'Report cards (last 2 years)', status: 'pending' },
      { item: 'Teacher reference letter', status: 'pending' },
      { item: 'Standardized test scores (if available)', status: 'pending' }
    ];
    if (selectedSchool.financial_aid_available) docChecklist.push({ item: 'Financial aid application', status: 'pending' });

    generatedActionPlan = { visitTimeline: visitWindow, dayAdmissionDeadlines: { deadline: selectedSchool.day_admission_deadline || null, financialAidDeadline: selectedSchool.financial_aid_deadline || null, isEstimated: !selectedSchool.day_admission_deadline }, documentChecklist: docChecklist, followUpQuestions: deepDiveAnalysis.visit_questions || [], fitSummary: deepDiveAnalysis.fit_label };

    // Fire-and-forget artifact persistence
    (async () => {
      const generatedAt = new Date().toISOString();
      const upsert = async (artifactType: string, fields: any) => {
        const existing = await GeneratedArtifact.filter({ user_id: userId, school_id: selectedSchoolId, artifact_type: artifactType });
        if (existing?.length > 0) {
          await GeneratedArtifact.update(existing[0].id, { ...fields, generated_at: generatedAt, conversation_id: conversationId || '' });
        } else {
          await GeneratedArtifact.create({ user_id: userId, school_id: selectedSchoolId, conversation_id: conversationId || '', artifact_type: artifactType, school_name: selectedSchool.name, generated_at: generatedAt, status: 'active', ...fields });
        }
      };
      await Promise.allSettled([
        upsert('action_plan', { content: JSON.stringify(generatedActionPlan), is_locked: !isPremiumUser, metadata: { version: 'E30_V1' } }),
        upsert('deep_dive_recommendation', { content: sanitizedMessage, metadata: { version: 'E30_V1' } }),
        ...(fullVisitPrepKit ? [upsert('visit_prep_kit', { content: JSON.stringify(fullVisitPrepKit), is_locked: false, metadata: { version: 'E30_V1' } })] : [])
      ]);
    })();
  }

  // Follow-up prompt
  let followUpPrompt = '';
  const fitLabel = deepDiveAnalysis?.fit_label || 'worth_exploring';
  const childName = conversationFamilyProfile?.child_name || 'your child';
  const schoolName = selectedSchool?.name || 'this school';
  const deepDiveFollowUpKey = `deepDiveFollowUpShown_${selectedSchoolId}`;
  const alreadyShownFollowUp = context?.[deepDiveFollowUpKey] === true;

  if (deepDiveAnalysis && selectedSchool && !alreadyShownFollowUp) {
    if (fitLabel === 'strong_match') {
      followUpPrompt = consultantName === 'Jackie'
        ? `\n\n---\n\n${schoolName} looks like a really strong fit for ${childName}. Have you thought about scheduling a visit?`
        : `\n\n---\n\n**Bottom line:** ${schoolName} is a strong fit. If you haven't visited yet, that's the next step.`;
    } else if (fitLabel === 'good_match') {
      followUpPrompt = consultantName === 'Jackie'
        ? `\n\n---\n\n${schoolName} has a lot going for it. Would you like to **compare it** with another school?`
        : `\n\n---\n\n**Next move:** ${schoolName} is solid. **Compare it** or **prep for a visit**.`;
    } else {
      followUpPrompt = consultantName === 'Jackie'
        ? `\n\n---\n\n${schoolName} has some interesting strengths. Would you like to **compare it** with another school?`
        : `\n\n---\n\nThere are trade-offs here. Want to **compare ${schoolName} against another option**?`;
    }
  }

  const conciseMessage = extractConciseSummary(sanitizedMessage);
  const finalMessage = conciseMessage + followUpPrompt;

  const isPremium = selectedSchool.school_tier === 'growth' || selectedSchool.school_tier === 'pro';
  const tourRequestOffered = isPremium && upcomingEvents.length > 0;

  return {
    message: finalMessage,
    state: currentState,
    briefStatus,
    schools: currentSchools || [],
    familyProfile: conversationFamilyProfile,
    conversationContext: { ...context, [deepDiveFollowUpKey]: true },
    deepDiveAnalysis,
    visitPrepKit: generatedVisitPrepKit,
    actionPlan: generatedActionPlan,
    tourRequestOffered,
    rawToolCalls: rawToolCalls || []
  };
}

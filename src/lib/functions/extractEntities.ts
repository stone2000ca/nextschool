// Function: extractEntities
// Purpose: Extract family profile data from parent messages with intent classification (pure — no DB writes)
// Last Modified: 2026-03-21
// Dependencies: InvokeLLM
// WC-1: F11 FIX — strip non-schema keys before DB write to prevent Firestore rejection
// WC-2: LLM model upgrade — MiniMax M2.5 as primary model in callOpenRouter waterfall
// WC-3: S122 extraction bug fixes — location false positive, interests list, gender keywords
// S1-S2: Typed contracts + decoupled persistence (FamilyProfile.update moved to orchestrate.ts)
// S3-S5: Narrowed LLM scope, protected fields, delta-only output

// =============================================================================
// TYPES: Extraction input/output contracts
// =============================================================================

export interface ExtractionInput {
  message: string;
  aiReply?: string;
  conversationFamilyProfile?: Record<string, any>;
  context?: Record<string, any>;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface ExtractedDelta {
  child_name?: string;
  child_grade?: number;
  child_gender?: string;
  location_area?: string;
  max_tuition?: number | string;
  interests?: string[];
  priorities?: string[];
  dealbreakers?: string[];
  curriculum_preference?: string;
  religious_preference?: string;
  boarding_preference?: string;
  school_gender_preference?: string;
  school_gender_exclusions?: string[];
  parent_notes?: Array<{ note: string; source: string; timestamp: string }>;
  remove_priorities?: string[];
  remove_interests?: string[];
  remove_dealbreakers?: string[];
  // S3-S5: Habits, constraints, preferences
  commute_tolerance?: string;
  schedule_preference?: string;
  homework_tolerance?: string;
  open_to_boarding?: boolean;
  flexible_on_commute?: boolean;
  [key: string]: any; // escape hatch for LLM extras not yet in schema
}

export interface ExtractionOutput {
  extractedEntities: ExtractedDelta;
  updatedFamilyProfile: Record<string, any>;
  updatedContext: Record<string, any>;
  intentSignal: string;
  briefDelta: { additions: any[]; updates: any[]; removals: any[] };
}

// =============================================================================
// S3-S5: Protected fields — only updated on explicit correction patterns
// =============================================================================

const PROTECTED_FIELDS = new Set([
  'child_name', 'child_grade', 'child_gender', 'gender', 'location_area', 'max_tuition'
]);

const CORRECTION_PATTERN = /\b(actually|correct(?:ion)?|changed?\s+(?:to|my)|moved?\s+to|we\s+moved|use\s+\w+\s+instead|not\s+\w+\s*,?\s*(?:but|it'?s)|now\s+(?:in|at|going)|switch(?:ed|ing)\s+to|update\s+(?:my|the|our)|wrong|mistake|meant\s+to\s+say|no\s*,?\s*(?:it'?s|she'?s|he'?s|we'?re)|let\s+me\s+correct)\b/i;

// =============================================================================
// INLINED: callOpenRouter (from handleBrief pattern)
// =============================================================================
async function callOpenRouter(options: any) {
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.7 } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];

  const body: any = {
    models,
    messages,
    max_tokens: maxTokens,
    temperature
  };

  if (responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: responseSchema.name || 'response',
        strict: true,
        schema: responseSchema.schema
      }
    };
  }

  console.log('[OPENROUTER] Calling extractEntities with models:', body.models, 'maxTokens:', maxTokens);

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nextschool.ca',
        'X-OpenRouter-Title': 'NextSchool'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms in extractEntities.ts`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS / 1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed in extractEntities.ts:`, error.message);
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OPENROUTER] API error:', response.status, errorText);
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('[OPENROUTER] Response model used:', data.model, 'usage:', data.usage);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');

  if (responseSchema) {
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('[OPENROUTER] JSON parse failed:', content.substring(0, 200));
      throw new Error('OpenRouter structured output parse failed');
    }
  }

  return content;
}

// =============================================================================
// INLINED: extractEntitiesLogic
// =============================================================================
export async function extractEntitiesLogic({ message: rawMessage, aiReply, conversationFamilyProfile, context, conversationHistory }: ExtractionInput): Promise<ExtractionOutput> {
  // E41-S3: When aiReply is provided (RESULTS deferred extraction), append it to the user prompt for richer context
  const message = aiReply
    ? `${rawMessage}\n\n[AI CONSULTANT REPLY FOR CONTEXT: ${aiReply}]`
    : rawMessage;

  console.log('[EXTRACT] Processing message:', message?.substring(0, 50));

  let result: any = {};
  let extractedData: any = {};
  let intentSignal = 'continue';

  try {
    const t1 = Date.now();

    const knownData = conversationFamilyProfile ? {
      child_name: conversationFamilyProfile.child_name,
      child_grade: conversationFamilyProfile.child_grade,
      location_area: conversationFamilyProfile.location_area,
      max_tuition: conversationFamilyProfile.max_tuition,
      interests: conversationFamilyProfile.interests,
      priorities: conversationFamilyProfile.priorities,
      dealbreakers: conversationFamilyProfile.dealbreakers,
      curriculum_preference: conversationFamilyProfile.curriculum_preference,
      religious_preference: conversationFamilyProfile.religious_preference,
      boarding_preference: conversationFamilyProfile.boarding_preference,
      parent_notes: conversationFamilyProfile.parent_notes || []
    } : {};

    const conversationSummary = conversationHistory?.slice(-5)
      .filter((m: any) => m?.content)
      .map((m: any) => `${m.role === 'user' ? 'Parent' : 'AI'}: ${m.content}`)
      .join('\n') || '';

    const gradeMatch = message.match(/\b(?:grade|gr\.?)\s*([0-9]+|\b(?:pk|jk|k|junior|senior)\b)/i);
    let extractedGrade: number | null = null;
    if (gradeMatch) {
      const gradeStr = gradeMatch[1].toLowerCase();
      const gradeMap: Record<string, number> = { 'pk': -2, 'jk': -1, 'k': 0, 'junior': 11, 'senior': 12 };
      extractedGrade = gradeMap[gradeStr] !== undefined ? gradeMap[gradeStr] : parseInt(gradeStr);
    } else {
      // Age-to-grade conversion if no explicit grade mentioned
      const ageMatch = message.match(/\b(?:name\s+)?is\s+(\d{1,2})(?:\s+years?\s+old)?\b/i);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 2 && age <= 18) {
          if (age === 3) extractedGrade = -2; // PK
          else if (age === 4) extractedGrade = -1; // JK
          else if (age === 5) extractedGrade = 0; // K
          else if (age >= 6) extractedGrade = age - 5; // Grade 1 for age 6, Grade 2 for age 7, etc.
          console.log('[EXTRACT] Age detection: converted age', age, 'to grade', extractedGrade);
        }
      }
    }

    let extractedGender: string | null = null;
    if (/\b(son|boy|he|him|his)\b/i.test(message)) extractedGender = 'male';
    else if (/\b(daughter|girl|she|her|hers)\b/i.test(message)) extractedGender = 'female';

    let extractedChildName: string | null = null;
    const namePatterns = [
      /\b([A-Z][a-z]{1,20})(?:'s)\s+(?:mom|dad|mother|father|parent|mum|mama|papa)\b/i,
      /\bfor\s+(?:my\s+)?(?:son|daughter|boy|girl|child|kid)\s+([A-Z][a-z]{1,20})\b/i,
      /\b(?:have|got)\s+(?:a\s+)?(?:\d+[\s-]?year[\s-]?old\s+)?(?:son|daughter|boy|girl|child|kid),?\s+([A-Z][a-z]{1,20})\b/i,
      /\bmy\s+(?:\d+[\s-]?year[\s-]?old),?\s+([A-Z][a-z]{1,20})\b/i,
      /\b(?:son|daughter|boy|girl|child|kid),?\s+([A-Z][a-z]{1,20}),?\s+(?:is|who|needs|wants|loves|goes|just|currently|has)\b/i,
      /\bour\s+(?:son|daughter|boy|girl|child|kid)\s+([A-Z][a-z]{1,20})\b/i,
      /\b(?:schools?|program)\s+for\s+([A-Z][a-z]{1,20})\b/i,
      /\bmy\s+(?:son|daughter|boy|girl|child|kid)\s+([A-Z][a-z]{1,20})\b/i,
      /\b(?:son|daughter|boy|girl|child|kid)\s+(?:is\s+)?named\s+([A-Z][a-z]{1,20})\b/i,
      /\b(?:name\s+is|named|called)\s+([A-Z][a-z]{1,20})\b/i,
      /\b([A-Z][a-z]{1,20})\s+is\s+(?:my\s+)?(?:son|daughter|boy|girl|child|kid)\b/i,
    ];
    const PRONOUN_BLOCKLIST = new Set([
      'my', 'his', 'her', 'he', 'she', 'him', 'the', 'a', 'an', 'i', 'we', 'our', 'they', 'it', 'this', 'that',
      'not', 'but', 'and', 'also', 'just', 'very', 'really', 'some', 'any', 'all', 'both', 'each',
      'about', 'into', 'been', 'does', 'has', 'had', 'was', 'are', 'can', 'will', 'would', 'should', 'could',
      'there', 'here', 'what', 'when', 'how', 'where', 'why', 'who', 'which', 'their', 'your', 'its',
      'school', 'grade', 'class', 'looking', 'need', 'help', 'find', 'search', 'want', 'like', 'love',
      'good', 'best', 'new', 'old', 'currently', 'recently', 'maybe', 'actually', 'basically'
    ]);
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1] && !PRONOUN_BLOCKLIST.has(match[1].toLowerCase())) {
        extractedChildName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        break;
      }
    }

    let extractedInterests: string[] = [];
    const interestsMatch = message.match(/(?:loves?|enjoys?|into|interested in|passionate about|likes?)\s+(.+?)(?:[.!?]|$)/i);
    if (interestsMatch) {
      extractedInterests = interestsMatch[1]
        .split(/,\s*|\s+and\s+/)
        .map((s: string) => s.trim().replace(/\.$/, ''))
        .filter((s: string) => s.length > 0 && s.length < 40);
    }

    // Regex detection for explicit school gender preference / exclusions
    let extractedSchoolGenderPref: string | null = null;
    let extractedSchoolGenderExclusions: string[] = [];
    if (/\b(all[\s-]girls?|girls?[\s-]only|single[\s-]gender.*girl|only girls?)\b/i.test(message)) extractedSchoolGenderPref = 'all-girls';
    else if (/\b(all[\s-]boys?|boys?[\s-]only|single[\s-]gender.*boy|only boys?)\b/i.test(message)) extractedSchoolGenderPref = 'all-boys';
    else if (/\b(co[\s-]?ed|coeducational|mixed gender)\b/i.test(message)) extractedSchoolGenderPref = 'co-ed';
    if (/\bno (all[\s-]?boys?|boys?[\s-]?only)\b/i.test(message)) extractedSchoolGenderExclusions.push('all-boys');
    if (/\bno (all[\s-]?girls?|girls?[\s-]?only)\b/i.test(message)) extractedSchoolGenderExclusions.push('all-girls');

    // FIX-LOC-004: Helper function to clean non-geographic words from location strings
    const cleanLocation = (loc: string | null) => {
      if (!loc) return null;
      const nonGeographicKeywords = /\b(budget|tuition|price|cost|afford|pay|spend|priority|priorities|interest|looking|need|want|IB|AP|STEM|IGCSE|Montessori|Waldorf|Reggio|Programs?)\b/gi;
      let cleaned = loc.replace(nonGeographicKeywords, '').replace(/\s,/, ',').trim();
      cleaned = cleaned.replace(/,+$/, '').replace(/\s\s+/g, ' ').trim();
      return cleaned === '' ? null : cleaned;
    };

    let extractedLocation: string | null = null;
    const NON_LOCATION_TERMS = /^(IB|AP|STEM|IGCSE|Montessori|Waldorf|Reggio|French|Programs?|Immersion|Curriculum|English|Math|Science|Art|Music|Drama|History|Swimming|Robotics|Coding|Hockey|Soccer|Basketball|Tennis|Debate)$/i;
    const locationMatch = message.match(/(?<!interested\s)(?<!enrolled\s)(?<!participate\s)(?<!believe\s)\b(?:in|near|around|from)\s+([a-zA-Z]+(?:[\s-][a-zA-Z]+)?(?:,\s*[A-Za-z]{2,})?)/);
    if (locationMatch && locationMatch[1]) {
      const hasCapitalizedWord = /\b[A-Z]/.test(locationMatch[1]);
      if (!hasCapitalizedWord) {
        console.log('[BUG-LOCATION-S46] Rejected: no capitalized word in location match:', locationMatch[1]);
      } else if (!NON_LOCATION_TERMS.test(locationMatch[1].trim())) {
        extractedLocation = cleanLocation(locationMatch[1].trim());
      }
    }

    // BUG-ENT-004 + F2 FIX: Budget extraction — handle ranges (e.g. "$15K-$20K") and use max value
    let extractedBudget: number | null = null;
    const budgetRangeMatch = message.match(/\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|K|thousand)?\s*(?:-|to)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|K|thousand)?/i);
    if (budgetRangeMatch) {
      const parse = (numStr: string, rawSegment: string) => {
        const n = parseInt(numStr.replace(/,/g, ''));
        const isK = /[kK]/.test(rawSegment) || /thousand/i.test(rawSegment);
        return isK ? n * 1000 : n;
      };
      const lo = parse(budgetRangeMatch[1], budgetRangeMatch[0]);
      const hi = parse(budgetRangeMatch[2], budgetRangeMatch[0]);
      const maxVal = Math.max(lo, hi);
      if (maxVal >= 5000 && maxVal <= 500000) {
        extractedBudget = maxVal;
        console.log(`[BUDGET-RANGE] Extracted max of range: ${lo}-${hi} → ${maxVal}`);
      }
    }
    if (extractedBudget === null) {
      const budgetMatch = message.match(/(?:budget|tuition|cost|price|afford|pay|spend)?[\s:]*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|K|thousand)?(?:\b|$)/i);
      if (budgetMatch) {
        const raw = budgetMatch[0];
        const numStr = budgetMatch[1].replace(/,/g, '');
        const num = parseInt(numStr);
        if (!isNaN(num)) {
          const isThousands = /[kK]/.test(raw) || /thousand/i.test(raw);
          const amount = isThousands ? num * 1000 : num;
          if (amount >= 5000 && amount <= 500000) {
            extractedBudget = amount;
          }
        }
      }
    }

    // S3-S5: Narrowed LLM prompt — focused on preferences, values, constraints, and intent.
    // Protected fields (name, grade, gender, location, budget) are handled by regex only.
    const systemPrompt = `You are a school-preference extractor. Analyze the parent's message and return a JSON delta of ONLY newly mentioned or changed preferences. Return NULL for anything not mentioned in THIS message.

YOUR SCOPE — extract ONLY these categories:

1. PRIORITIES (school requirements): curriculum type, teaching style, class size, gender policy, religious affiliation, boarding, learning support, structured environment, STEM focus, French immersion, arts program, etc.
2. INTERESTS (child activities): robotics, art, soccer, coding, music, drama, debate, swimming, hockey, etc.
3. DEALBREAKERS (hard no's): things the parent explicitly rejects or won't accept.
4. PARENT_NOTES (soft signals): implied preferences, concerns, or family context not captured above. Write short, factual observations:
   - "My son has ADHD" → ["Child has ADHD — needs learning support"]
   - "Can we afford private on one income?" → ["Budget-sensitive — single income household"]
   - "Worried about bullying" → ["Bullying prevention is a concern"]
   Also map to schema when applicable: "ADHD" → priorities: ["learning support"] AND parent_notes.
   parent_notes are ADDITIVE — return empty [] if nothing new.
5. HABITS & CONSTRAINTS:
   - commute_tolerance: "short"/"medium"/"long"/"any" (only if mentioned)
   - schedule_preference: "early drop-off"/"late pickup"/"before-after care needed" (only if mentioned)
   - homework_tolerance: "light"/"moderate"/"heavy"/"any" (only if mentioned)
   - open_to_boarding: true/false (only if mentioned)
   - flexible_on_commute: true/false (only if mentioned)

CLASSIFICATION RULES:
- PRIORITIES = what the SCHOOL must offer/be. INTERESTS = what the CHILD likes doing.
- 'STEM-focused school' = PRIORITY. 'likes robotics' = INTEREST. 'boys-only' = PRIORITY. 'structured learning' = PRIORITY. 'coding' = INTEREST.

REMOVALS: If the user negates a preference ("not interested in sports", "remove arts", "changed my mind about boarding"), populate remove_interests, remove_priorities, or remove_dealbreakers. Additive arrays are for NEW additions only.

INTENT SIGNALS — set intentSignal to one of:
- 'continue' (default — normal conversation)
- 'confirm-brief' — user confirms brief ("that looks right", "show me schools", "yes", "confirmed", "go ahead")
- 'visit_debrief' — user mentions having VISITED/TOURED a school ("I visited Branksome Hall", "we toured the school")
- 'visit_prep_request' — user requests visit prep kit ("prepare my visit kit", "tour preparation")
- 'shortlist-action' — user wants to add/save/bookmark a school ("add to shortlist", "save that school")

DO NOT extract: child_name, child_grade, child_gender, location_area, max_tuition. These are handled separately.

Return ONLY changed/new fields as JSON. Omit fields with no new information. Do NOT explain.`;

    const userPrompt = `CURRENT KNOWN DATA:
${JSON.stringify(knownData, null, 2)}

CONVERSATION HISTORY (last 5 messages):
${conversationSummary}

PARENT'S MESSAGE:
"${message}"

Extract all factual data from the parent's message. Return ONLY valid JSON. Do NOT explain.`;

    try {
      let llmResult: any = {};

      try {
        const llmResponse = await callOpenRouter({
          systemPrompt,
          userPrompt,
          maxTokens: 800,
          temperature: 0.3
        });
        llmResult = llmResponse;
        console.log('[EXTRACT] LLM call succeeded');
      } catch (llmCallError: any) {
        console.warn('[EXTRACT] LLM call failed, falling back to regex-only extraction:', llmCallError.message);
        llmResult = {};
      }

      if (typeof llmResult === 'string') {
        try { llmResult = JSON.parse(llmResult); } catch { llmResult = {}; }
      }
      result = llmResult || {};
      intentSignal = result?.intentSignal || 'continue';

      // Deterministic regex override — force shortlist-action regardless of LLM output
      const shortlistPatterns = /\b(add|save|shortlist|bookmark|keep)\b.{0,40}\b(school|academy|college|it|that|this|one)\b|\b(shortlist|save|add)\s+(it|that|this)\b|\badd\b.{0,30}\bto\b.{0,20}\b(shortlist|list|saved)\b/i;
      if (shortlistPatterns.test(message)) {
        intentSignal = 'shortlist-action';
        console.log('[INTENT OVERRIDE] shortlist-action detected via regex');
      }

      console.log('[INTENT SIGNAL]', intentSignal);
    } catch (llmError: any) {
      console.error('[EXTRACT ERROR] LLM call failed:', llmError.message);
      result = {};
      intentSignal = 'continue';
    }

    let finalResult: any = result || {};
    if (extractedGrade !== null && !finalResult.child_grade) {
      finalResult = { ...finalResult, child_grade: extractedGrade };
    }
    const strongGenderKeyword = /\b(son|daughter|boy|girl)\b/i.test(message);
    if (extractedGender !== null && (strongGenderKeyword || !finalResult.gender)) {
      finalResult = { ...finalResult, gender: extractedGender };
    }
    if (finalResult.gender) {
      finalResult.child_gender = finalResult.gender;
    }
    if (extractedChildName && (!finalResult.child_name || PRONOUN_BLOCKLIST.has(finalResult.child_name.toLowerCase()))) {
      finalResult = { ...finalResult, child_name: extractedChildName };
    }
    if (extractedSchoolGenderPref && !finalResult.school_gender_preference) {
      finalResult = { ...finalResult, school_gender_preference: extractedSchoolGenderPref };
    }
    if (extractedSchoolGenderExclusions.length > 0 && (!finalResult.school_gender_exclusions || finalResult.school_gender_exclusions.length === 0)) {
      finalResult = { ...finalResult, school_gender_exclusions: extractedSchoolGenderExclusions };
    }
    if ((finalResult.max_tuition === null || finalResult.max_tuition === undefined) && extractedBudget !== null) {
      finalResult = { ...finalResult, max_tuition: extractedBudget };
    }
    if (extractedInterests.length > 0 && (!finalResult.interests || finalResult.interests.length < extractedInterests.length)) {
      finalResult = { ...finalResult, interests: [...new Set([...(finalResult.interests || []), ...extractedInterests])] };
    }
    let effectiveLocation = finalResult.location_area;
    if (effectiveLocation) {
      effectiveLocation = cleanLocation(effectiveLocation);
    }

    // S97-WC4: If LLM returned an invalid location (e.g. 'Grade' from 'Grade 5'),
    // but regex found a valid city/region, prefer the regex-extracted location.
    const isInvalidLocation = !effectiveLocation || effectiveLocation.length < 3 || /^(grade|school|class|program|budget|tuition|montessori|french|immersion|programs?)\b/i.test(effectiveLocation);

    if (isInvalidLocation && extractedLocation !== null) {
      effectiveLocation = extractedLocation;
    }

    if (effectiveLocation !== null && effectiveLocation !== undefined) {
      finalResult = { ...finalResult, location_area: effectiveLocation };
    }

    // S3-S5: Protected-field gating — strip protected fields unless correction detected
    const isCorrection = CORRECTION_PATTERN.test(rawMessage);
    if (!isCorrection) {
      for (const field of PROTECTED_FIELDS) {
        if (field in finalResult) {
          console.log(`[PROTECTED] Stripping "${field}" — no correction pattern detected`);
          delete finalResult[field];
        }
      }
    } else {
      console.log('[PROTECTED] Correction pattern detected — allowing protected field updates');
    }

    // Clean nulls and empty arrays
    const cleaned: any = {};
    for (const [key, value] of Object.entries(finalResult)) {
      if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
        cleaned[key] = value;
      }
    }

    // S3-S5: Delta-only — diff against existing profile, keep only changed fields
    const NON_DIFFABLE_KEYS = new Set(['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers']);
    const delta: any = {};
    for (const [key, value] of Object.entries(cleaned)) {
      if (NON_DIFFABLE_KEYS.has(key)) {
        delta[key] = value; // always pass through control fields
        continue;
      }
      const existing = conversationFamilyProfile?.[key];
      if (Array.isArray(value)) {
        // For arrays: include if any new items not in existing
        if (!Array.isArray(existing) || existing.length === 0) {
          delta[key] = value;
        } else {
          const existingSet = new Set(existing.map((s: any) => typeof s === 'string' ? s.toLowerCase() : JSON.stringify(s)));
          const newItems = value.filter((item: any) => {
            const normalized = typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item);
            return !existingSet.has(normalized);
          });
          if (newItems.length > 0) {
            delta[key] = value; // pass full array so merge logic in orchestrate can union
          }
        }
      } else {
        // For scalars: include only if different from existing
        if (existing !== value) {
          delta[key] = value;
        }
      }
    }

    extractedData = delta;
    if (Object.keys(delta).filter(k => !NON_DIFFABLE_KEYS.has(k)).length === 0) {
      console.log('[EXTRACT] Empty delta — no actionable changes detected');
    } else {
      console.log('[EXTRACT] Delta fields:', Object.keys(delta).filter(k => !NON_DIFFABLE_KEYS.has(k)));
    }

    // E41-S4: Transform parent_notes from LLM (string[]) into structured objects and dedup
    if (Array.isArray(extractedData.parent_notes) && extractedData.parent_notes.length > 0) {
      const existingNotes: any[] = conversationFamilyProfile?.parent_notes || [];
      const existingNormalized = existingNotes.map((n: any) => (n.note || '').toLowerCase().trim());
      const now = new Date().toISOString();

      const newNotes: any[] = [];
      for (const raw of extractedData.parent_notes) {
        const noteText = typeof raw === 'string' ? raw : raw?.note;
        if (!noteText || typeof noteText !== 'string') continue;
        const normalized = noteText.toLowerCase().trim();
        const isDup = existingNormalized.some((ex: string) =>
          ex === normalized || ex.includes(normalized) || normalized.includes(ex)
        );
        if (isDup) {
          console.log('[PARENT_NOTES] Skipping duplicate:', noteText);
          continue;
        }
        newNotes.push({ note: noteText, source: 'conversation', timestamp: now });
        existingNormalized.push(normalized);
      }

      if (newNotes.length > 0) {
        extractedData.parent_notes = [...existingNotes, ...newNotes];
        console.log('[PARENT_NOTES] Appended', newNotes.length, 'new notes, total:', extractedData.parent_notes.length);
      } else {
        delete extractedData.parent_notes;
        console.log('[PARENT_NOTES] No new notes to add');
      }
    }

    console.log('[EXTRACT] took', Date.now() - t1, 'ms');
  } catch (e: any) {
    console.error('[ERROR] Extraction failed:', e.message);
  }

  // Build updatedContext with delta merged into extractedEntities
  const updatedContext = { ...context };
  if (!updatedContext.extractedEntities) {
    updatedContext.extractedEntities = {};
  }
  for (const [key, value] of Object.entries(extractedData)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        if (Array.isArray(updatedContext.extractedEntities[key]) && updatedContext.extractedEntities[key].length > 0) {
          updatedContext.extractedEntities[key] = [...new Set([...updatedContext.extractedEntities[key], ...value])];
        } else {
          updatedContext.extractedEntities[key] = value;
        }
      } else {
        updatedContext.extractedEntities[key] = value;
      }
    }
  }

  // S3-S5: Apply delta to profile using applyExtractionDelta (exported for use by orchestrate.ts)
  const updatedFamilyProfile = applyExtractionDelta(conversationFamilyProfile || {}, extractedData);

  const briefDelta = extractedData?.briefDelta || { additions: [], updates: [], removals: [] };
  intentSignal = intentSignal || 'continue';

  return {
    extractedEntities: extractedData,
    updatedFamilyProfile,
    updatedContext,
    intentSignal,
    briefDelta
  };
}

// =============================================================================
// S3-S5: applyExtractionDelta — apply an ExtractedDelta to an existing profile
// Exported so orchestrate.ts can use the same merge logic.
// =============================================================================
export function applyExtractionDelta(
  existingProfile: Record<string, any>,
  delta: ExtractedDelta
): Record<string, any> {
  const REMOVAL_MAP: Record<string, string> = {
    remove_priorities: 'priorities',
    remove_interests: 'interests',
    remove_dealbreakers: 'dealbreakers'
  };

  const updated = { ...existingProfile };
  const deltaKeys = Object.keys(delta);
  if (deltaKeys.length === 0) return updated;

  // Process removals first
  for (const [removeKey, targetField] of Object.entries(REMOVAL_MAP)) {
    const toRemove = delta[removeKey];
    if (Array.isArray(toRemove) && toRemove.length > 0 && Array.isArray(updated[targetField])) {
      const removeSet = new Set(toRemove.filter(Boolean).map((s: string) => s.toLowerCase()));
      updated[targetField] = updated[targetField].filter(
        (item: string) => !removeSet.has(item.toLowerCase())
      );
      console.log(`[DELTA-MERGE] ${targetField}: removed [${toRemove.join(', ')}]`);
    }
  }

  // Process additions/updates
  for (const [key, value] of Object.entries(delta)) {
    if (key in REMOVAL_MAP) continue;
    if (value === null || value === undefined) continue;
    const existing = updated[key];
    if (key === 'parent_notes') {
      // parent_notes: already fully merged array from extraction — assign directly
      updated[key] = value;
    } else if (Array.isArray(value)) {
      // Arrays: union-merge with existing
      if (Array.isArray(existing) && existing.length > 0) {
        updated[key] = [...new Set([...existing, ...value])];
      } else {
        updated[key] = value;
      }
    } else if (value !== '') {
      // Scalars: overwrite
      updated[key] = value;
    }
  }

  return updated;
}

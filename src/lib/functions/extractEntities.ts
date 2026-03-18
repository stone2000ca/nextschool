// Function: extractEntities
// Purpose: Extract and persist family profile data from parent messages with intent classification
// Entities: FamilyProfile
// Last Modified: 2026-03-09
// Dependencies: Base44 InvokeLLM
// WC-1: F11 FIX — strip non-schema keys before DB write to prevent Firestore rejection
// WC-2: LLM model upgrade — MiniMax M2.5 as primary model in callOpenRouter waterfall
// WC-3: S122 extraction bug fixes — location false positive, interests list, gender keywords

import { FamilyProfile } from '@/lib/entities-server'

// =============================================================================
// INLINED: extractEntitiesLogic
// =============================================================================
export async function extractEntitiesLogic({ message: rawMessage, aiReply, conversationFamilyProfile, context, conversationHistory }: {
  message: string;
  aiReply?: string;
  conversationFamilyProfile?: any;
  context?: any;
  conversationHistory?: any[];
}) {
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
      childName: conversationFamilyProfile.childName,
      childGrade: conversationFamilyProfile.childGrade,
      locationArea: conversationFamilyProfile.locationArea,
      maxTuition: conversationFamilyProfile.maxTuition,
      interests: conversationFamilyProfile.interests,
      priorities: conversationFamilyProfile.priorities,
      dealbreakers: conversationFamilyProfile.dealbreakers,
      curriculumPreference: conversationFamilyProfile.curriculumPreference,
      religiousPreference: conversationFamilyProfile.religiousPreference,
      boardingPreference: conversationFamilyProfile.boardingPreference
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

    const systemPrompt = `Extract factual data from the parent's message. Return JSON with NULL for anything not mentioned.

GENDER INFERENCE (BUG-ENT-004): Infer the child's gender from relational terms even if not stated directly:
- "my son", "my boy", "he", "him", "his" → gender = "male"
- "my daughter", "my girl", "she", "her" → gender = "female"
- If gender is ambiguous or not mentioned, return null for gender.

BUDGET EXTRACTION (BUG-ENT-004): Extract budget/tuition even in conversational formats:
- "$25K", "25k", "25 thousand", "around $25,000", "about 25K", "up to 30k" → extract the number (e.g. 25000, 30000)
- Store as maxTuition (integer number of dollars, or the string "unlimited" if they say no limit/flexible)
- Do NOT infer budget if user has not explicitly stated it.

CRITICAL: If the user explicitly negates or removes a previously stated preference (e.g. "actually, not interested in sports", "remove arts from my priorities", "I changed my mind about boarding"), populate the corresponding remove_* field (remove_interests, remove_priorities, remove_dealbreakers) with the items to remove. Leave additive arrays for new additions only.

CRITICAL: If the user mentions having VISITED, TOURED, or SEEN a school — phrases like "I visited Branksome Hall", "we toured the school", "we went to the open house", "just got back from visiting", "we saw the campus" — set intentSignal to 'visit_debrief'. This takes priority over 'continue' and 'ask-about-school'.

LOCATION SPECIFICITY (BUG-LOC-003): For locationArea, always use the most specific location the user mentioned — city name, NOT province or state. Examples: "Montreal" not "Quebec", "Vancouver" not "British Columbia", "Calgary" not "Alberta". If the user says a region alias like "GTA" or "Greater Toronto Area", preserve that exact term as-is.

LOCATION vs CURRICULUM: locationArea must ONLY contain geographic places. IB, AP, STEM, Montessori, Waldorf, Reggio, IGCSE, French immersion are curriculum types — put them in priorities, never locationArea.

LOCATION vs ACADEMIC SUBJECTS: Academic subjects like English, Math, Science, Art, Music, History, Drama are NEVER locations. 'does well in English' means the subject, not a place. Only extract geographic places as locationArea.

AGE vs GRADE HANDLING:
- If the user says "[name] is [number]" or "[name] is [number] years old" WITHOUT the word "grade", treat the number as AGE, not grade.
- Convert age to grade: age 3 = PK (grade -2), age 4 = JK (grade -1), age 5 = K (grade 0), age 6+ = grade (age - 5). So age 6 = grade 1, age 7 = grade 2, etc.
- If unclear whether age or grade, return childGrade as null and let the conversation ask for clarification.
- "grade 3" or "in grade 3" = grade 3. "is 3" or "is 3 years old" = age 3 = PK.

PRIORITY vs INTEREST CLASSIFICATION:
- PRIORITIES = requirements the SCHOOL must meet (curriculum type, teaching style, class size, gender policy, religious affiliation, boarding, learning support, structured environment, boys-only, STEM focus, French immersion)
- INTERESTS = things the CHILD enjoys or wants to do (robotics club, art classes, soccer, coding, music, drama, debate)
- When in doubt, if it describes what the SCHOOL should offer/be, it's a PRIORITY. If it describes what the CHILD likes doing, it's an INTEREST.
- Examples: 'STEM-focused school' = PRIORITY. 'likes robotics' = INTEREST. 'boys-only' = PRIORITY. 'structured learning' = PRIORITY. 'coding' = INTEREST.

CRITICAL: If the user confirms the brief or says something like "that looks right", "show me schools", "yes", "confirmed", "let's see", "go ahead", set intentSignal to 'confirm-brief'.
CRITICAL: If the user requests a Visit Prep Kit or tour preparation — phrases like "yes prepare my visit kit", "prepare the kit", "yes make it", "visit prep", "tour preparation", "prepare that", "yes please" (in context of a visit kit offer) — set intentSignal to 'visit_prep_request'.

CRITICAL: If the user asks to add, save, shortlist, or bookmark a specific school — phrases like "add Howlett Academy to my shortlist", "save that school", "shortlist Rosedale", "add it", "keep that one", "I want to save this school", "add to my list" — set intentSignal to 'shortlist-action'. This takes priority over 'ask-about-school' and 'continue'.

E41-CONVERSATION CAPTURE: Even when the parent is asking a question (not providing search criteria), capture any implied preferences, concerns, or family context as soft signals in parentNotes[].
Write short, factual observations:
- "My son has ADHD" → parentNotes: ["Child has ADHD — needs learning support"]
- "Can we afford private on one income?" → parentNotes: ["Budget-sensitive — single income household"]
- "Is Montessori good for shy kids?" → parentNotes: ["Exploring Montessori — child may be introverted"]
- "What about French immersion?" → parentNotes: ["Parent interested in French immersion programs"]
- "Worried about bullying" → parentNotes: ["Bullying prevention is a concern"]
Also map to existing schema when applicable:
- "French immersion" → priorities: ["French immersion"] AND parentNotes
- "ADHD" → priorities: ["learning support"] AND parentNotes
- "Budget is tight" → parentNotes only (no maxTuition override without a number)
parentNotes are ADDITIVE — never remove prior notes. Deduplicate if semantically identical. Return empty array [] if nothing new to capture.`;

    const userPrompt = `CURRENT KNOWN DATA:
${JSON.stringify(knownData, null, 2)}

CONVERSATION HISTORY (last 5 messages):
${conversationSummary}

PARENT'S MESSAGE:
"${message}"

Extract all factual data from the parent's message. Return ONLY valid JSON. Do NOT explain.`;

    try {
      const combinedPrompt = systemPrompt + '\n\n' + userPrompt;
      // TODO: Replace with your LLM call implementation
      // For now, this is a placeholder that returns empty extraction
      // In production, call your LLM service here
      let llmResult: any = {};

      // Placeholder: In production, replace with actual LLM call
      // e.g., const llmResult = await callLLM({ prompt: combinedPrompt, ... });
      console.log('[EXTRACT] LLM call placeholder - implement with your LLM service');

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
    if (extractedGrade !== null && !finalResult.childGrade) {
      finalResult = { ...finalResult, childGrade: extractedGrade };
    }
    const strongGenderKeyword = /\b(son|daughter|boy|girl)\b/i.test(message);
    if (extractedGender !== null && (strongGenderKeyword || !finalResult.gender)) {
      finalResult = { ...finalResult, gender: extractedGender };
    }
    if (finalResult.gender) {
      finalResult.childGender = finalResult.gender;
    }
    if (extractedChildName && (!finalResult.childName || PRONOUN_BLOCKLIST.has(finalResult.childName.toLowerCase()))) {
      finalResult = { ...finalResult, childName: extractedChildName };
    }
    if (extractedSchoolGenderPref && !finalResult.schoolGenderPreference) {
      finalResult = { ...finalResult, schoolGenderPreference: extractedSchoolGenderPref };
    }
    if (extractedSchoolGenderExclusions.length > 0 && (!finalResult.schoolGenderExclusions || finalResult.schoolGenderExclusions.length === 0)) {
      finalResult = { ...finalResult, schoolGenderExclusions: extractedSchoolGenderExclusions };
    }
    if ((finalResult.maxTuition === null || finalResult.maxTuition === undefined) && extractedBudget !== null) {
      finalResult = { ...finalResult, maxTuition: extractedBudget };
    }
    if (extractedInterests.length > 0 && (!finalResult.interests || finalResult.interests.length < extractedInterests.length)) {
      finalResult = { ...finalResult, interests: [...new Set([...(finalResult.interests || []), ...extractedInterests])] };
    }
    let effectiveLocation = finalResult.locationArea;
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
      finalResult = { ...finalResult, locationArea: effectiveLocation };
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(finalResult)) {
      if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
        cleaned[key] = value;
      }
    }

    extractedData = cleaned;
    console.log('[EXTRACT] took', Date.now() - t1, 'ms');
  } catch (e: any) {
    console.error('[ERROR] Extraction failed:', e.message);
  }

  const updatedContext = { ...context };
  if (!updatedContext.extractedEntities) {
    updatedContext.extractedEntities = {};
  }
  // CRT-S109-F11 FIX: Merge extracted data directly into context for FamilyBrief display
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

  const REMOVAL_MAP: Record<string, string> = {
    remove_priorities: 'priorities',
    remove_interests: 'interests',
    remove_dealbreakers: 'dealbreakers'
  };

  const updatedFamilyProfile = { ...conversationFamilyProfile };
  if (Object.keys(extractedData).length > 0) {
    for (const [removeKey, targetField] of Object.entries(REMOVAL_MAP)) {
      const toRemove = extractedData[removeKey];
      if (Array.isArray(toRemove) && toRemove.length > 0 && Array.isArray(updatedFamilyProfile[targetField])) {
        const removeSet = new Set(toRemove.filter(Boolean).map((s: string) => s.toLowerCase()));
        updatedFamilyProfile[targetField] = updatedFamilyProfile[targetField].filter(
          (item: string) => !removeSet.has(item.toLowerCase())
        );
        console.log(`[REMOVE] ${targetField}: removed [${toRemove.join(', ')}]`);
      }
    }

    for (const [key, value] of Object.entries(extractedData)) {
      if (key in REMOVAL_MAP) continue;
      if (value !== null && value !== undefined) {
        const existing = updatedFamilyProfile[key];
        if (Array.isArray(value)) {
          if (Array.isArray(existing) && existing.length > 0) {
            updatedFamilyProfile[key] = [...new Set([...existing, ...value])];
          } else {
            updatedFamilyProfile[key] = value;
          }
        } else if (value !== '') {
          updatedFamilyProfile[key] = value;
        }
      }
    }
    if (updatedFamilyProfile?.id) {
      try {
        // F11 FIX: Strip non-schema keys before DB write to prevent Firestore rejection
        const NON_SCHEMA_KEYS = ['intentSignal', 'briefDelta', 'remove_priorities', 'remove_interests', 'remove_dealbreakers', 'gender'];
        const profileToSave = { ...updatedFamilyProfile };
        for (const key of NON_SCHEMA_KEYS) {
          delete profileToSave[key];
        }
        const persistedProfile = await FamilyProfile.update(updatedFamilyProfile.id, profileToSave);
        Object.assign(updatedFamilyProfile, persistedProfile);
        console.log('[EXTRACT] FamilyProfile persisted successfully:', updatedFamilyProfile.id);
      } catch (e: any) {
        console.error('[EXTRACT] Non-fatal: FamilyProfile update failed, using stale profile:', e.message);
      }
    }
  }

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

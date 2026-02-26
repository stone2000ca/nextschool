import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// All functions inlined to avoid 404 errors with Deno local imports

// INLINED: callOpenRouter (InvokeLLM fallback removed)
async function callOpenRouter(options) {
  const { systemPrompt, userPrompt, responseSchema, maxTokens = 1000, temperature = 0.7 } = options;
  
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }
  
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  
  const body = {
    models: ['google/gemini-2.5-flash', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash-lite'],
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
  
  console.log('[OPENROUTER] Calling with models:', body.models, 'maxTokens:', maxTokens);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nextschool.ca',
      'X-OpenRouter-Title': 'NextSchool'
    },
    body: JSON.stringify(body)
  });
  
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

// INLINED: extractEntities
async function extractEntities(params) {
  const { base44, message, conversationFamilyProfile, context, conversationHistory } = params;

  let extractedData = {};
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
      .map(m => `${m.role === 'user' ? 'Parent' : 'AI'}: ${m.content}`)
      .join('\n') || '';

    const gradeMatch = message.match(/\b(?:grade|gr\.?)\s*([0-9]+|\b(?:pk|jk|k|junior|senior)\b)/i);
    let extractedGrade = null;
    if (gradeMatch) {
      const gradeStr = gradeMatch[1].toLowerCase();
      const gradeMap = { 'pk': -2, 'jk': -1, 'k': 0, 'junior': 11, 'senior': 12 };
      extractedGrade = gradeMap[gradeStr] !== undefined ? gradeMap[gradeStr] : parseInt(gradeStr);
    }

    const systemPrompt = `Extract ONLY factual data explicitly stated. Return JSON with NULL for anything not mentioned.

    RESPONSE SCHEMA:
    { 
      entities: { childName, childGrade, locationArea, ... all extraction fields },
      intentSignal: 'continue' | 'request-brief' | 'request-results' | 'edit-criteria' | 'ask-about-school' | 'back-to-results' | 'restart' | 'off-topic',
      briefDelta: { 
        additions: [{ field, value, confidence }],
        updates: [{ field, old, new, confidence }],
        removals: []
      }
    }
    Confidence values: 'explicit' (directly stated) | 'inferred' (clear from context) | 'contextual' (weak signal).

    EXTRACTION FIELDS:
    - childName: string or null
    - childAge: number or null (KI-14: extract if user mentions age in years, e.g., "14 years old" → 14)
    - childGrade: number or null (e.g., 3 for Grade 3, -1 for JK, 0 for SK)
    - childGender: "male" OR "female" OR null (KI-16: "son", "boy", "he/him" → "male"; "daughter", "girl", "she/her" → "female")
    - locationArea: string (city name)
    - budgetMin: number or null (minimum budget in dollars)
    - budgetMax: number or null (maximum budget in dollars)
    - budgetSingle: number or null (KI-15: Set if user states a budget amount, INCLUDING approximate or hedged amounts like "around", "about", "roughly", "up to", "no more than", "hoping to stay under". Extract the numeric value. Convert shorthand: $25K=25000, $30K=30000, 30k=30000. If user gives a range, use budgetMin/budgetMax instead.)
    - maxTuition: "unlimited" OR number OR null (for backward compatibility)
    - interests: array of strings or null
    - priorities: array of strings or null (FIX 4: When user says "arts", "music", "theater", "drama" → priorities: ["Arts"]. When "STEM", "science", "math" → priorities: ["STEM"]. When "sports" → priorities: ["Sports"]. When "languages", "French", "Spanish" → priorities: ["Languages"])
    - dealbreakers: array or null
    - learning_needs: array or null (e.g., "ADHD", "ASD", "dyslexia", "ESL", "gifted", "learning disability")
    - wellbeing_needs: array or null (KI-13: "anxiety", "behavioral issues", "acting out", "feeling unsafe", "divorce impact", "depression", "social struggles", "confidence issues")
    - childrenJson: string or null (KI-10: If the parent mentions MORE THAN ONE child, return a JSON array string of child objects. Example: '[{"name":"Emma","grade":9,"gender":"female","interests":["STEM","robotics"],"priorities":["AP courses"],"learningNeeds":[]},{"name":"Noah","grade":3,"gender":"male","interests":[],"priorities":["small classes"],"learningNeeds":["dyslexia"]}]'. If only ONE child mentioned, return null.)
    - curriculumPreference: array or null (e.g., "French immersion", "IB", "AP", "Montessori", "progressive", "traditional")
    - programPreferences: array or null (e.g., "outdoor education", "French immersion", "arts focus", "STEM", "athletics", "music program")
    - religiousPreference: string or null
    - boardingPreference: boolean or null
    - genderPreference: "Co-Ed" OR "All Boys" OR "All Girls" OR null
    - classSize: string or null (e.g., "small", "standard", "15 students", "intimate")
    - requestedSchools: array of school names or null
    - financialAidInterest: boolean or null
    - specialNeeds: array or null (e.g., "ADHD", "ASD", "dyslexia", "ESL support")

    INTENT CLASSIFICATION:
    Also classify the user's intent with intentSignal. Possible values:
    - 'continue': User is providing info, asking questions during discovery
    - 'request-brief': User asks to generate brief or summary
    - 'request-results': User asks to see school matches/results
    - 'edit-criteria': User wants to change/adjust brief details
    - 'ask-about-school': User asks about a specific school
    - 'back-to-results': User wants to go back to results list
    - 'restart': User wants to start over
    - 'off-topic': Message is off-topic or unclear`;

    const userPrompt = `CURRENT KNOWN DATA:
    ${JSON.stringify(knownData, null, 2)}

    CONVERSATION HISTORY (last 10 messages):
    ${conversationSummary}

    PARENT'S MESSAGE:
    "${message}"

    Extract all factual data from the parent's message. Return ONLY valid JSON. Do NOT explain.`;

    let result;
    try {
      result = await callOpenRouter({
        systemPrompt,
        userPrompt,
        responseSchema: {
          name: 'entity_extraction_with_intent',
          schema: {
            type: 'object',
            properties: {
              childName: { type: ['string', 'null'] },
              childAge: { type: ['number', 'null'] },
              childGrade: { type: ['number', 'null'] },
              childGender: { type: ['string', 'null'] },
              locationArea: { type: ['string', 'null'] },
              budgetMin: { type: ['number', 'null'] },
              budgetMax: { type: ['number', 'null'] },
              budgetSingle: { type: ['number', 'null'] },
              maxTuition: { type: ['number', 'null'] },
              priorities: { type: 'array', items: { type: 'string' } },
              interests: { type: 'array', items: { type: 'string' } },
              dealbreakers: { type: 'array', items: { type: 'string' } },
              learning_needs: { type: 'array', items: { type: 'string' } },
              wellbeing_needs: { type: 'array', items: { type: 'string' } },
              curriculumPreference: { type: 'array', items: { type: 'string' } },
              programPreferences: { type: 'array', items: { type: 'string' } },
              genderPreference: { type: ['string', 'null'] },
              boardingPreference: { type: ['boolean', 'null'] },
              religiousPreference: { type: ['string', 'null'] },
              intentSignal: { type: 'string', enum: ['continue', 'request-brief', 'request-results', 'edit-criteria', 'ask-about-school', 'back-to-results', 'restart', 'off-topic'] },
              briefDelta: {
                type: 'object',
                properties: {
                  additions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        value: {},
                        confidence: { type: 'string', enum: ['explicit', 'inferred', 'contextual'] }
                      },
                      required: ['field', 'value', 'confidence']
                    }
                  },
                  updates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        old: {},
                        new: {},
                        confidence: { type: 'string', enum: ['explicit', 'inferred', 'contextual'] }
                      },
                      required: ['field', 'old', 'new', 'confidence']
                    }
                  },
                  removals: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            required: ['intentSignal', 'briefDelta'],
            additionalProperties: false
          }
        },
        maxTokens: 500,
        temperature: 0.1
      });
      intentSignal = result.intentSignal;
      console.log('[INTENT SIGNAL]', intentSignal);
      console.log('[EXTRACT] OpenRouter returned intentSignal:', intentSignal);
    } catch (openrouterError) {
      console.log('[OPENROUTER FALLBACK] Entity extraction falling back to InvokeLLM');
      const extractionPrompt = `Extract ONLY factual data explicitly stated. Return JSON with NULL for anything not mentioned.

    CURRENT KNOWN DATA:
    ${JSON.stringify(knownData, null, 2)}

    PARENT'S MESSAGE:
    "${message}"

    Extract ONLY:
    - childName: string or null
    - childAge: number or null (KI-14: extract if user mentions age in years, e.g., "14 years old" → 14)
    - childGrade: number or null (e.g., 3 for Grade 3, -1 for JK, 0 for SK)
    - childGender: "male" OR "female" OR null (KI-16: "son", "boy", "he/him" → "male"; "daughter", "girl", "she/her" → "female")
    - locationArea: string (city name)
    - budgetMin: number or null (minimum budget in dollars)
    - budgetMax: number or null (maximum budget in dollars)
    - budgetSingle: number or null (KI-15: Set if user states a budget amount, INCLUDING approximate or hedged amounts like "around", "about", "roughly", "up to", "no more than", "hoping to stay under". Extract the numeric value. Convert shorthand: $25K=25000, $30K=30000, 30k=30000. If user gives a range, use budgetMin/budgetMax instead.)
    - maxTuition: "unlimited" OR number OR null (for backward compatibility)
    - interests: array of strings or null
    - priorities: array of strings or null (FIX 4: When user says "arts", "music", "theater", "drama" → priorities: ["Arts"]. When "STEM", "science", "math" → priorities: ["STEM"]. When "sports" → priorities: ["Sports"]. When "languages", "French", "Spanish" → priorities: ["Languages"])
    - concerns: array or null
    - dealbreakers: array or null
    - learning_needs: array or null (e.g., "ADHD", "ASD", "dyslexia", "ESL", "gifted", "learning disability")
    - wellbeing_needs: array or null (KI-13: "anxiety", "behavioral issues", "acting out", "feeling unsafe", "divorce impact", "depression", "social struggles", "confidence issues")
    - childrenJson: string or null (KI-10: If the parent mentions MORE THAN ONE child, return a JSON array string of child objects. Each object should have: name (string or null), age (number or null), grade (number or null), gender ("male"/"female"/null), interests (array of strings), priorities (array of strings), learningNeeds (array of strings). Example: '[{"name":"Emma","grade":9,"gender":"female","interests":["STEM","robotics"],"priorities":["AP courses"],"learningNeeds":[]},{"name":"Noah","grade":3,"gender":"male","interests":[],"priorities":["small classes"],"learningNeeds":["dyslexia"]}]'. If only ONE child mentioned, return null.)
    - curriculumPreference: array or null (e.g., "French immersion", "IB", "AP", "Montessori", "progressive", "traditional")
    - programPreferences: array or null (e.g., "outdoor education", "French immersion", "arts focus", "STEM", "athletics", "music program")
    - religiousPreference: string or null
    - boardingPreference: string or null
    - genderPreference: "Co-Ed" OR "All Boys" OR "All Girls" OR null
    - classSize: string or null (e.g., "small", "standard", "15 students", "intimate")
    - requestedSchools: array of school names or null
    - financialAidInterest: boolean or null (triggered by "financial aid", "scholarship", "afford", "budget tight")
    - specialNeeds: array or null (e.g., "ADHD", "ASD", "dyslexia", "ESL support")

    EXAMPLES:
    - "My 14-year-old son" → childAge: 14, childGender: "male"
    - "She's 7" → childAge: 7, childGender: "female"
    - "My daughter is in Grade 5" → childGrade: 5, childGender: "female"
    - "He has anxiety and ADHD" → childGender: "male", learning_needs: ["ADHD"], wellbeing_needs: ["anxiety"]
    - "Budget around $20K" → budgetSingle: 20000
    - "Budget is around $30K" → budgetSingle: 30000
    - "About $25K" → budgetSingle: 25000
    - "Hoping to stay under $40K" → budgetSingle: 40000
    - "$25K" → budgetSingle: 25000
    - "35k budget" → budgetSingle: 35000
    - "Between $15,000 and $25,000" → budgetMin: 15000, budgetMax: 25000
    - "She has ADHD" → learning_needs: ["ADHD"], specialNeeds: ["ADHD"], childGender: "female"
    - "Looking for French immersion" → curriculumPreference: ["French immersion"], programPreferences: ["French immersion"]
    - "She's been acting out after the divorce" → wellbeing_needs: ["behavioral issues", "divorce impact"], childGender: "female"
    - "He feels unsafe at his current school" → wellbeing_needs: ["feeling unsafe"], childGender: "male"
    - "Small class sizes important" → classSize: "small"
    - "Music and theater are important" → priorities: ["Arts"]
    - "Co-ed school preferred" → genderPreference: "Co-Ed"

    Return ONLY valid JSON. Do NOT explain.`;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: extractionPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            childName: { type: ["string", "null"] },
            childAge: { type: ["number", "null"] },
            childGrade: { type: ["number", "null"] },
            childGender: { type: ["string", "null"] },
            locationArea: { type: ["string", "null"] },
            budgetMin: { type: ["number", "null"] },
            budgetMax: { type: ["number", "null"] },
            budgetSingle: { type: ["number", "null"] },
            maxTuition: { type: ["number", "string", "null"] },
            interests: { type: ["array", "null"], items: { type: "string" } },
            priorities: { type: ["array", "null"], items: { type: "string" } },
            concerns: { type: ["array", "null"], items: { type: "string" } },
            dealbreakers: { type: ["array", "null"], items: { type: "string" } },
            learning_needs: { type: ["array", "null"], items: { type: "string" } },
            wellbeing_needs: { type: ["array", "null"], items: { type: "string" } },
            childrenJson: { type: ["string", "null"] },
            curriculumPreference: { type: ["array", "null"], items: { type: "string" } },
            programPreferences: { type: ["array", "null"], items: { type: "string" } },
            religiousPreference: { type: ["string", "null"] },
            boardingPreference: { type: ["string", "null"] },
            genderPreference: { type: ["string", "null"] },
            classSize: { type: ["string", "null"] },
            requestedSchools: { type: ["array", "null"], items: { type: "string" } },
            financialAidInterest: { type: ["boolean", "null"] },
            specialNeeds: { type: ["array", "null"], items: { type: "string" } },
            intentSignal: { type: ["string"] },
            briefDelta: {
              type: ["object", "null"],
              properties: {
                additions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      value: {},
                      confidence: { type: "string" }
                    }
                  }
                },
                updates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      old: {},
                      new: {},
                      confidence: { type: "string" }
                    }
                  }
                },
                removals: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });
      if (result?.intentSignal) {
        intentSignal = result.intentSignal;
      }
      console.log('[EXTRACT] InvokeLLM returned intentSignal:', intentSignal);
      console.log('[OPENROUTER FALLBACK] Entity extraction failed, using InvokeLLM result');
    }

    let finalResult = result;
    if (extractedGrade !== null && !result.childGrade) {
     finalResult = { ...result, childGrade: extractedGrade };
    }
    
    // KI-14: Age-to-grade conversion
    if (finalResult.childAge && !finalResult.childGrade) {
      const ageToGradeMap = {
        4: -1, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 11, 17: 12, 18: 12
      };
      const convertedGrade = ageToGradeMap[finalResult.childAge];
      if (convertedGrade !== undefined) {
        finalResult = { ...finalResult, childGrade: convertedGrade };
        console.log('[KI-14] Converted age', finalResult.childAge, 'to grade', convertedGrade);
      }
    }
    
    // KI-15: Budget single-value handling
    if (finalResult.budgetSingle && !finalResult.budgetMin && !finalResult.budgetMax) {
      finalResult = { ...finalResult, maxTuition: finalResult.budgetSingle };
      console.log('[KI-15] Set budgetSingle', finalResult.budgetSingle, 'as maxTuition');
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(finalResult)) {
     if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
       cleaned[key] = value;
     }
    }
    
    extractedData = cleaned;
    console.log('[EXTRACT] took', Date.now() - t1, 'ms');
  } catch (e) {
    console.error('[ERROR] Extraction failed:', e.message);
  }
  
  // FIX A: Merge extracted entities into context for accumulation
  const updatedContext = { ...context };
  if (!updatedContext.extractedEntities) {
    updatedContext.extractedEntities = {};
  }
  for (const [key, value] of Object.entries(extractedData)) {
    if (value !== null && value !== undefined) {
      // Merge arrays instead of replacing
      if (Array.isArray(value) && Array.isArray(updatedContext.extractedEntities[key]) && updatedContext.extractedEntities[key].length > 0) {
        updatedContext.extractedEntities[key] = [...new Set([...updatedContext.extractedEntities[key], ...value])];
      } else {
        updatedContext.extractedEntities[key] = value;
      }
    }
  }
  
  // KI-10: Store childrenJson in context (not persisted to FamilyProfile entity)
  if (extractedData.childrenJson) {
    updatedContext.extractedEntities.childrenJson = extractedData.childrenJson;
  }
  
  // Prepare updated FamilyProfile
  const updatedFamilyProfile = { ...conversationFamilyProfile };
  if (Object.keys(extractedData).length > 0) {
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined) {
        const existing = updatedFamilyProfile[key];
        
        // Array fields: merge and deduplicate
        if (Array.isArray(value)) {
          if (Array.isArray(existing) && existing.length > 0) {
            updatedFamilyProfile[key] = [...new Set([...existing, ...value])];
          } else {
            updatedFamilyProfile[key] = value;
          }
        } 
        // Scalar fields: overwrite if new value is non-empty
        else if (value !== '') {
          updatedFamilyProfile[key] = value;
        }
        // If value is empty string, keep existing value (no update)
      }
    }
    if (updatedFamilyProfile?.id) {
      try {
        // CRITICAL FIX: Pass the fully merged updatedFamilyProfile object to preserve all existing data
        const persistedProfile = await base44.entities.FamilyProfile.update(updatedFamilyProfile.id, updatedFamilyProfile);
        Object.assign(updatedFamilyProfile, persistedProfile);
      } catch (e) {
        console.error('FamilyProfile update failed:', e);
      }
    }
  }
  
  // Extract briefDelta from result (will be used in Sprint B)
  const briefDelta = result?.briefDelta || { additions: [], updates: [], removals: [] };
  
  // Safety fallback for intentSignal
  intentSignal = intentSignal || 'continue';
  
  return {
    extractedEntities: extractedData,
    updatedFamilyProfile,
    updatedContext,
    intentSignal,
    briefDelta
  };
}

// INLINED: resolveTransition (from context-snapshot)
function resolveTransition(params) {
  const {
    currentState,
    intentSignal,
    profileData,
    turnCount,
    briefEditCount,
    selectedSchoolId,
    previousSchoolId,
    message
  } = params;

  const STATES = {
    WELCOME: 'WELCOME',
    DISCOVERY: 'DISCOVERY',
    BRIEF: 'BRIEF',
    RESULTS: 'RESULTS',
    DEEP_DIVE: 'DEEP_DIVE'
  };

  const hasLocation = !!(profileData?.location);
  const hasGrade = profileData?.gradeLevel !== null && profileData?.gradeLevel !== undefined;
  const prioritiesCount = profileData?.priorities?.length || 0;
  
  let sufficiency = 'THIN';
  if (hasLocation && hasGrade) {
    if (prioritiesCount >= 2) {
      sufficiency = 'RICH';
    } else {
      sufficiency = 'MINIMUM';
    }
  }

  const flags = {
    SUGGEST_BRIEF: false,
    OFFER_BRIEF: false,
    FORCED_TRANSITION: false,
    USER_INTENT_OVERRIDE: false
  };

  let nextState = currentState;
  let briefStatus = null;
  let transitionReason = 'natural';

  console.log('[RESOLVE] Input:', { currentState, intentSignal, sufficiency, turnCount, briefEditCount, selectedSchoolId });

  if (currentState === STATES.WELCOME && turnCount > 0) {
    nextState = STATES.DISCOVERY;
    transitionReason = 'auto_welcome_exit';
    console.log('[R1] WELCOME->DISCOVERY (conversation started)');
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (selectedSchoolId && selectedSchoolId !== previousSchoolId) {
    nextState = STATES.DEEP_DIVE;
    transitionReason = 'school_selected';
    console.log('[R2] Override to DEEP_DIVE (school selected)');
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (message && currentState === STATES.DISCOVERY) {
    const messageLower = message.toLowerCase();
    const briefPatterns = [
      'show me my brief',
      'show me the brief',
      'give me the brief',
      'generate my brief',
      'put together the brief',
      'ready for my brief',
      'show me schools',
      'just show me schools',
      'show me results',
      'i\'ve shared everything',
      'that\'s all i have',
      'i\'ve told you everything',
      'enough questions',
      'stop asking'
    ];

    const matchedKeyword = briefPatterns.find(pattern => messageLower.includes(pattern));
    if (matchedKeyword) {
      console.log('[R2.5] Deterministic intent escape triggered:', matchedKeyword);
      console.log('[RESOLVE] Output:', { nextState: STATES.BRIEF, sufficiency, flags: { USER_INTENT_OVERRIDE: true }, transitionReason: 'deterministic_escape', briefStatus: 'generating' });
      return {
        nextState: STATES.BRIEF,
        sufficiency,
        flags: { ...flags, USER_INTENT_OVERRIDE: true },
        transitionReason: 'deterministic_escape',
        briefStatus: 'generating'
      };
    }
  }

  if ((intentSignal === 'request-brief' || intentSignal === 'request-results') && currentState === STATES.DISCOVERY) {
    console.log('[R3] ABSOLUTE ESCAPE - intent:', intentSignal, 'sufficiency:', sufficiency, 'turnCount:', turnCount);
    console.log('[RESOLVE] Output:', { nextState: STATES.BRIEF, sufficiency, flags: { USER_INTENT_OVERRIDE: true }, transitionReason: 'explicit_demand' });
    return {
      nextState: STATES.BRIEF,
      sufficiency,
      flags: { ...flags, USER_INTENT_OVERRIDE: true },
      transitionReason: 'explicit_demand',
      briefStatus: 'generating'
    };
  }

  if (turnCount >= 7 && currentState === STATES.DISCOVERY) {
    nextState = STATES.BRIEF;
    briefStatus = 'generating';
    flags.FORCED_TRANSITION = true;
    transitionReason = 'hard_cap';
    console.log('[R4] Escape Rule: Hard cap at turn 7, forcing BRIEF');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason, briefStatus };
  }

  if (turnCount >= 5 && currentState === STATES.DISCOVERY && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
    flags.SUGGEST_BRIEF = true;
    transitionReason = 'soft_nudge';
    console.log('[R5] Escape Rule: Soft nudge at turn 5');
    console.log('[RESOLVE] Output:', { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason });
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason };
  }

  if (intentSignal === 'request-brief' && turnCount < 2 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
    nextState = STATES.BRIEF;
    briefStatus = 'generating';
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: request-brief -> BRIEF (turnCount < 2)');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason, briefStatus };
  }

  if (intentSignal === 'request-results' && turnCount < 2 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
    nextState = STATES.RESULTS;
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: request-results -> RESULTS (turnCount < 2)');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (intentSignal === 'edit-criteria') {
    nextState = STATES.BRIEF;
    briefStatus = 'editing';
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: edit-criteria -> BRIEF (editing)');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason, briefStatus };
  }

  if (intentSignal === 'back-to-results') {
    nextState = STATES.RESULTS;
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: back-to-results -> RESULTS');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (intentSignal === 'restart') {
    nextState = STATES.DISCOVERY;
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: restart -> DISCOVERY');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (intentSignal === 'ask-about-school') {
    nextState = STATES.DEEP_DIVE;
    flags.USER_INTENT_OVERRIDE = true;
    transitionReason = 'explicit_intent';
    console.log('[R6] Intent: ask-about-school -> DEEP_DIVE');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason };
  }

  if (currentState === STATES.DISCOVERY) {
    if (turnCount >= 8 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
      nextState = STATES.BRIEF;
      briefStatus = 'generating';
      flags.FORCED_TRANSITION = true;
      transitionReason = 'auto_threshold';
      console.log('[R7] Turn >= 8, force BRIEF');
      console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
      return { nextState, sufficiency, flags, transitionReason, briefStatus };
    }

    if (turnCount >= 6 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
      flags.OFFER_BRIEF = true;
      transitionReason = 'auto_threshold';
      console.log('[R7] Turn >= 6, set OFFER_BRIEF flag');
      console.log('[RESOLVE] Output:', { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason });
      return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason };
    }

    if (turnCount >= 4 && (sufficiency === 'MINIMUM' || sufficiency === 'RICH')) {
      flags.SUGGEST_BRIEF = true;
      transitionReason = 'auto_threshold';
      console.log('[R7] Turn >= 4, set SUGGEST_BRIEF flag');
      console.log('[RESOLVE] Output:', { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason });
      return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason };
    }
  }

  if (currentState === STATES.DISCOVERY && intentSignal === 'continue') {
    console.log('[R8] DISCOVERY + continue intent, stay DISCOVERY');
    console.log('[RESOLVE] Output:', { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason });
    return { nextState: STATES.DISCOVERY, sufficiency, flags, transitionReason };
  }

  if (intentSignal === 'off-topic') {
    console.log('[R9] Off-topic, stay in current state');
    console.log('[RESOLVE] Output:', { nextState: currentState, sufficiency, flags, transitionReason });
    return { nextState: currentState, sufficiency, flags, transitionReason };
  }

  if (currentState === STATES.BRIEF && briefEditCount >= 3) {
    nextState = STATES.RESULTS;
    briefStatus = 'confirmed';
    flags.FORCED_TRANSITION = true;
    transitionReason = 'edit_cap_reached';
    console.log('[R10] Edit cap reached (3), move to RESULTS');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason, briefStatus };
  }

  if (currentState === STATES.DEEP_DIVE && !selectedSchoolId) {
    nextState = STATES.RESULTS;
    console.log('[R11] DEEP_DIVE but no selectedSchoolId, back to RESULTS');
    console.log('[RESOLVE] Output:', { nextState, sufficiency, flags, transitionReason });
    return { nextState, sufficiency, flags, transitionReason };
  }

  console.log('[DEFAULT] Maintain current state:', currentState);
  console.log('[RESOLVE] Output:', { nextState: currentState, sufficiency, flags, transitionReason });
  return { nextState: currentState, sufficiency, flags, transitionReason };
}

Deno.serve(async (req) => {
  const TIMEOUT_MS = 25000;
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  );

  const processRequest = async () => {
    var classificationResult;
    var currentState;
    var briefStatus;
    
    try {
      const base44 = createClientFromRequest(req);
      const { message, conversationHistory, conversationContext, region, userId, consultantName, currentSchools, userNotes, shortlistedSchools, userLocation, selectedSchoolId } = await req.json();

    console.log('ORCH START', { 
      messageLength: message?.length, 
      hasConversationHistory: !!conversationHistory,
      conversationHistoryLength: conversationHistory?.length,
      hasConversationContext: !!conversationContext, 
      consultant: consultantName,
      userId: userId,
      hasUserLocation: !!userLocation
    });

    const context = conversationContext || {};
    const msgLower = message.toLowerCase();
    
    // STATE MACHINE: 5 states (strictly deterministic)
    const STATES = {
      WELCOME: 'WELCOME',
      DISCOVERY: 'DISCOVERY',
      BRIEF: 'BRIEF',
      RESULTS: 'RESULTS',
      DEEP_DIVE: 'DEEP_DIVE'
    };

    const BRIEF_STATUS = {
      GENERATING: 'generating',
      PENDING_REVIEW: 'pending_review',
      EDITING: 'editing',
      CONFIRMED: 'confirmed'
    };
    
    // KI-12 FIX PART B: City coordinates - MOVED TO handleResults.ts (only consumer)
    // CITY_COORDS removed from orchestrator — not referenced here
    
    let briefEditCount = context.briefEditCount || 0;
    const MAX_BRIEF_EDITS = 3;
    
    const conversationId = context.conversationId;
    
    // STEP 0: Initialize/retrieve FamilyProfile
    let conversationFamilyProfile = null;
    
    if (userId && conversationId) {
      try {
        const profiles = await base44.entities.FamilyProfile.filter({
          userId,
          conversationId: conversationId
        });
        conversationFamilyProfile = profiles.length > 0 ? profiles[0] : null;
        
        if (!conversationFamilyProfile) {
          conversationFamilyProfile = await base44.entities.FamilyProfile.create({
            userId,
            conversationId: conversationId
          });
          console.log('Created new FamilyProfile:', conversationFamilyProfile.id);
        }
      } catch (e) {
        console.error('FamilyProfile error:', e);
      }
    } else {
      conversationFamilyProfile = {
        childName: null,
        childGrade: null,
        locationArea: null,
        maxTuition: null,
        interests: [],
        priorities: [],
        dealbreakers: [],
        academicStrengths: []
      };
    }
    
    // STEP 1: WELCOME HANDLER (skip extraction for true welcome state)
    const isFirstMessage = conversationHistory?.length === 0;
    let extractionResult = null;
    let intentSignal = 'continue';
    let briefDelta = { additions: [], updates: [], removals: [] };
    let resolveResult = null;

    if (isFirstMessage && !context.state) {
      // True WELCOME: return greeting, skip extraction
      console.log('[ORCH] First message, return WELCOME greeting');
      return Response.json({
        message: "I'm your NextSchool education consultant. I help families find the perfect private school. Tell me about your child — what grade are they in, and what matters most to you?",
        state: STATES.WELCOME,
        briefStatus: null,
        conversationContext: context,
        schools: []
      });
    }

    // STEP 2: ENTITY EXTRACTION (all other messages)
    extractionResult = await extractEntities({ base44, message, conversationFamilyProfile, context, conversationHistory });
    const { extractedEntities, updatedFamilyProfile, updatedContext } = extractionResult;
    intentSignal = extractionResult.intentSignal || 'continue';
    briefDelta = extractionResult.briefDelta;
    
    // Apply results
    Object.assign(conversationFamilyProfile, updatedFamilyProfile);
    Object.assign(context, updatedContext);
    
    // STEP 3: BUILD PROFILE DATA FOR TRANSITION RESOLUTION
    const profileData = {
      location: conversationFamilyProfile?.locationArea || context.extractedEntities?.locationArea || null,
      gradeLevel: conversationFamilyProfile?.childGrade || context.extractedEntities?.childGrade || null,
      priorities: conversationFamilyProfile?.priorities || [],
      dealbreakers: conversationFamilyProfile?.dealbreakers || [],
      curriculum: conversationFamilyProfile?.curriculumPreference || [],
      schoolType: conversationFamilyProfile?.schoolType || null
    };
    
    const turnCount = (conversationHistory?.filter(m => m.role === 'user').length || 0) + 1;
    const currentBriefEditCount = context.briefEditCount || 0;
    const previousSchoolId = context.previousSchoolId || null;
    
    // STEP 4: RESOLVE TRANSITION (deterministic state machine)
    resolveResult = resolveTransition({
      currentState: context.state || STATES.WELCOME,
      intentSignal,
      profileData,
      turnCount,
      briefEditCount: currentBriefEditCount,
      selectedSchoolId,
      previousSchoolId,
      message
    });
    
    currentState = resolveResult.nextState;
    briefStatus = resolveResult.briefStatus || context.briefStatus || null;
    const { flags } = resolveResult;
    
    console.log('[ORCH] resolveTransition returned:', { nextState: resolveResult.nextState, intentSignal, sufficiency: resolveResult.sufficiency, flags: resolveResult.flags });
    
    // Update context with resolved state
    context.state = currentState;
    context.briefStatus = briefStatus;
    context.dataSufficiency = resolveResult.sufficiency;
    context.transitionReason = resolveResult.transitionReason;

    console.log(`[STATE] ${currentState} | briefStatus: ${briefStatus} | flags: ${JSON.stringify(flags)} | sufficiency: ${context.dataSufficiency} | reason: ${context.transitionReason}`);

    // SAFETY NET: Deterministic keyword escape at orchestrator level
    // Catches 'show me the brief' etc. even if resolveTransition's R2.5 was overwritten by sync
    if (currentState === STATES.DISCOVERY) {
      const msgCheck = (message || '').toLowerCase();
      const briefEscapeKeywords = ['show me my brief', 'show me the brief', 'give me the brief', 'generate my brief', 'show me schools', 'just show me schools', 'show me results', 'enough questions', 'stop asking'];
      const matchedEscape = briefEscapeKeywords.find(kw => msgCheck.includes(kw));
      if (matchedEscape) {
        console.log('[ORCH SAFETY NET] Keyword escape caught at orchestrator level:', matchedEscape);
        currentState = STATES.BRIEF;
        briefStatus = 'generating';
        context.state = currentState;
        context.briefStatus = briefStatus;
      }
    }

    // STEP 5: STATE-SPECIFIC RESPONSE GENERATION (pass flags to handlers)
    if (currentState === STATES.DISCOVERY) {
      return handleDiscovery({ 
        base44, 
        message, 
        conversationFamilyProfile, 
        context, 
        conversationHistory, 
        consultantName, 
        currentState, 
        briefStatus, 
        currentSchools, 
        conversationId, 
        userId,
        flags 
      });
    }
    
    if (currentState === STATES.BRIEF) {
      const briefResponse = await handleBrief({ 
        base44, 
        message, 
        conversationFamilyProfile, 
        context, 
        conversationHistory, 
        consultantName, 
        currentState, 
        briefStatus, 
        currentSchools, 
        conversationId, 
        userId,
        flags 
      });

      // BRIEF CONTENT SAFETY NET: If handleBrief returned generic/thin content
      // (Base44 version may be stale), rebuild programmatically from extracted entities.
      try {
        const briefData = await briefResponse.json();
        const briefMsg = briefData.message || '';
        const hasStructuredContent = briefMsg.includes('Grade') || briefMsg.includes('grade') || 
          briefMsg.includes('Location') || briefMsg.includes('Budget') || briefMsg.includes('Student:');
        const isGenericBrief = briefMsg.length < 150 || !hasStructuredContent;

        if (isGenericBrief && (context.extractedEntities || conversationFamilyProfile)) {
          console.log('[ORCH BRIEF SAFETY NET] Generic brief detected, length:', briefMsg.length, 'rebuilding programmatically');
          const bullets = [];
          if (conversationFamilyProfile?.childName) bullets.push('Student: ' + conversationFamilyProfile.childName);
          const grade = conversationFamilyProfile?.childGrade ?? context.extractedEntities?.childGrade;
          if (grade !== null && grade !== undefined) {
            bullets.push('Grade: ' + (grade === -1 ? 'JK' : grade === 0 ? 'SK' : 'Grade ' + grade));
          }
          const loc = conversationFamilyProfile?.locationArea || context.extractedEntities?.locationArea;
          if (loc) bullets.push('Location: ' + loc);
          const budget = conversationFamilyProfile?.maxTuition || context.extractedEntities?.budgetSingle;
          if (budget) bullets.push('Budget: $' + Number(budget).toLocaleString());
          if (conversationFamilyProfile?.genderPreference || context.extractedEntities?.genderPreference) {
            bullets.push('Gender preference: ' + (conversationFamilyProfile?.genderPreference || context.extractedEntities?.genderPreference));
          }
          if (conversationFamilyProfile?.curriculumPreference?.length) {
            bullets.push('Curriculum: ' + conversationFamilyProfile.curriculumPreference.join(', '));
          }
          if (conversationFamilyProfile?.programPreferences?.length) {
            bullets.push('Program preferences: ' + conversationFamilyProfile.programPreferences.join(', '));
          }
          if (conversationFamilyProfile?.priorities?.length) {
            bullets.push('Top priorities: ' + conversationFamilyProfile.priorities.join(', '));
          }
          const learningNeeds = conversationFamilyProfile?.learning_needs || conversationFamilyProfile?.specialNeeds || [];
          if (learningNeeds.length) bullets.push('Learning needs: ' + learningNeeds.join(', '));
          if (conversationFamilyProfile?.wellbeing_needs?.length) {
            bullets.push('Wellbeing needs: ' + conversationFamilyProfile.wellbeing_needs.join(', '));
          }
          if (conversationFamilyProfile?.interests?.length) {
            bullets.push('Interests: ' + conversationFamilyProfile.interests.join(', '));
          }
          if (conversationFamilyProfile?.dealbreakers?.length) {
            bullets.push('Dealbreakers: ' + conversationFamilyProfile.dealbreakers.join(', '));
          }
          if (context.extractedEntities?.boardingPreference) bullets.push('Boarding: Yes');
          if (context.extractedEntities?.religiousPreference) {
            bullets.push('Religious preference: ' + context.extractedEntities.religiousPreference);
          }

          if (bullets.length > 0) {
            const intro = consultantName === 'Jackie'
              ? "Let me make sure I've got this right:\n\n"
              : "Here's what I'm hearing:\n\n";
            briefData.message = intro + bullets.map(b => '\u2022 ' + b).join('\n') + "\n\nDoes that capture everything? Anything you'd like to adjust?";
            console.log('[ORCH BRIEF SAFETY NET] Rebuilt brief with', bullets.length, 'bullets');
          }
        }
        return new Response(JSON.stringify(briefData), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });
      } catch (safetyNetError) {
        console.error('[ORCH BRIEF SAFETY NET] Error:', safetyNetError.message, '- returning original response');
        // Can't re-read the response body (already consumed), so rebuild a minimal response
        return Response.json({
          message: "Here's what I've captured so far. Does that look right? Feel free to adjust anything.",
          state: STATES.BRIEF,
          briefStatus: briefStatus,
          familyProfile: conversationFamilyProfile,
          conversationContext: context,
          schools: []
        });
      }
    }

    if (currentState === STATES.RESULTS) {
      return handleResults({ 
        base44, 
        message, 
        conversationFamilyProfile, 
        context, 
        conversationHistory, 
        consultantName, 
        currentState, 
        briefStatus, 
        currentSchools, 
        selectedSchoolId, 
        userLocation, 
        region, 
        conversationId, 
        userId,
        flags 
      });
    }

    if (currentState === STATES.DEEP_DIVE) {
      return handleDeepDive({ 
        base44, 
        selectedSchoolId, 
        message, 
        conversationFamilyProfile, 
        context, 
        conversationHistory, 
        consultantName, 
        currentState, 
        briefStatus, 
        currentSchools, 
        conversationId, 
        userId,
        flags 
      });
    }

      // Fallback
      return Response.json({
       message: 'I encountered an unexpected state. Please try again.',
       state: currentState,
       briefStatus: briefStatus,
       schools: [],
       familyProfile: conversationFamilyProfile,
       conversationContext: context
      });

    } catch (error) {
      console.error('orchestrateConversation FATAL:', error);
      return Response.json({ error: error.message || String(error) }, { status: 500 });
    }
  };

  try {
    return await Promise.race([processRequest(), timeoutPromise]);
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      return Response.json({ 
        error: 'Request timeout',
        status: 408 
      }, { status: 408 });
    }
    return Response.json({ 
      error: 'Something went wrong. Please try again.',
      status: 500 
    }, { status: 500 });
  }
});
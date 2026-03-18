// @ts-nocheck
// Function: lightweightExtract + mergeProfile
// Purpose: Zero-LLM regex-based entity extraction (<5ms) and safe profile merging
// Last Modified: 2026-03-18
// Dependencies: None (pure functions)
// S111-WC3: Child name, curriculum, dealbreakers, interests extraction
// S113-WC1: Location curated city regex
// S114-WC1: Preserve dealbreakers across merge chain

// =============================================================================
// mergeProfile — safe field merge that never overwrites arrays with empty
// =============================================================================
export function mergeProfile(base, incoming) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;
    const existing = merged[key];
    if (Array.isArray(value)) {
      if (Array.isArray(existing) && existing.length > 0) {
        if (value.length === 0) continue;
        merged[key] = [...new Set([...existing, ...value])];
      } else {
        merged[key] = value;
      }
    } else {
      if (value !== '') merged[key] = value;
    }
  }
  return merged;
}

// =============================================================================
// LIGHTWEIGHT REGEX EXTRACTION — zero LLM calls, <5ms execution
// =============================================================================
export function lightweightExtract(message, existingProfile) {
  const bridgeProfile: Record<string, any> = {};
  let bridgeIntent = 'continue';

  // Grade extraction: "grade 9", "going into grade 9", "9th grade", "kindergarten", "JK", "SK"
  const gradeMatch = message.match(/(?:going\s+)?(?:into\s+)?(?:grade|gr\.?)\s+([0-9]+|pk|jk|sk|k|kindergarten|junior|senior)/i);
  if (gradeMatch) {
    const gradeStr = gradeMatch[1].toLowerCase();
    const gradeMap = { 'pk': -2, 'jk': -1, 'sk': 0, 'k': 0, 'kindergarten': 0, 'junior': 11, 'senior': 12 };
    const grade = gradeMap[gradeStr] !== undefined ? gradeMap[gradeStr] : parseInt(gradeStr);
    if (!isNaN(grade)) bridgeProfile.childGrade = grade;
  }

  // Location extraction
  // S113-WC1: Location fix - curated city regex + await extractEntities at BRIEF/RESULTS
  const locMatch = message.match(/(?:live\s+)?(?:in|near|around|from)\s+([a-zA-Z\s]+?)(?:\s+(?:area|region|city|province|state)|\.|\s*$|,)/i);
  if (locMatch) {
    const loc = locMatch[1].trim();
    const NON_GEO = /\b(IB|AP|STEM|IGCSE|Montessori|Waldorf|Reggio|French|Programs?|Immersion|Curriculum|English|Math|Science|Art|Music|Drama)\b/gi;
    const cleanedLoc = loc.replace(NON_GEO, '').replace(/\s+/g, ' ').trim();
    if (cleanedLoc.length > 2 && /[A-Z]/.test(cleanedLoc)) { bridgeProfile.locationArea = cleanedLoc; }
  }
  // S113-WC1: Secondary fallback — bare city name or known Canadian region (no preposition required)
  if (!bridgeProfile.locationArea) {
    const KNOWN_LOCATIONS = ['Greater Toronto Area', 'GTA', 'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton', 'Mississauga', 'Oakville', 'Markham', 'Richmond Hill', 'Burlington', 'Hamilton', 'Brampton', 'Vaughan', 'Waterloo', 'Kitchener', 'London', 'Victoria'];
    for (const knownLoc of KNOWN_LOCATIONS) {
      const escaped = knownLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(message)) {
        bridgeProfile.locationArea = knownLoc;
        break;
      }
    }
  }

  // Budget extraction
  const budgetMatches = message.matchAll(/(\$)\s*(\d{1,3}(?:,\d{3})*|\d+)\s*([kK])?|(\d{1,3}(?:,\d{3})*|\d+)\s*([kK])/g);
  let maxBudgetFound = 0;
  for (const match of budgetMatches) {
    let numStr, hasKilo;
    if (match[1]) {
      numStr = match[2];
      hasKilo = !!match[3];
    } else {
      numStr = match[4];
      hasKilo = !!match[5];
    }
    const num = parseInt(numStr.replace(/,/g, ''));
    if (!isNaN(num)) {
      const amount = hasKilo ? num * 1000 : num;
      if (amount >= 5000 && amount <= 500000) {
        maxBudgetFound = Math.max(maxBudgetFound, amount);
      }
    }
  }
  if (maxBudgetFound > 0) {
    bridgeProfile.maxTuition = maxBudgetFound;
  }

  // Gender extraction
  const strongGenderKw = /\b(son|daughter)\b/i.test(message);
  if (strongGenderKw || !existingProfile?.childGender) {
    if (/\b(son|boy|he|him|his)\b/i.test(message)) { bridgeProfile.childGender = 'male'; bridgeProfile.gender = 'male'; }
    else if (/\b(daughter|girl|she|her)\b/i.test(message)) { bridgeProfile.childGender = 'female'; bridgeProfile.gender = 'female'; }
  }

  // S111-WC3: Child name extraction
  if (!existingProfile?.childName) {
    const nameMatch = message.match(/\b(?:my\s+)?(?:son|daughter|child|kid)\s+(?:is\s+)?(?:named\s+)?([A-Z][a-z]{1,15})\b/) ||
                      message.match(/\b(?:named|name\s+is|call(?:ed)?)\s+([A-Z][a-z]{1,15})\b/) ||
                      message.match(/\b([A-Z][a-z]{1,15})\s+(?:is\s+)?(?:my\s+)?(?:son|daughter|child|kid)\b/) ||
                      message.match(/\b([A-Z][a-z]{1,15})\s+(?:is\s+)?(?:in\s+)?grade\s+/);
    if (nameMatch) {
      const candidateName = nameMatch[1];
      const CITY_NAMES = new Set(['Toronto', 'Vancouver', 'Ottawa', 'Montreal', 'Calgary', 'Edmonton', 'Winnipeg', 'Halifax', 'Victoria', 'London', 'Boston', 'Chicago']);
      if (!CITY_NAMES.has(candidateName)) {
        bridgeProfile.childName = candidateName;
      }
    }
  }

  // S111-WC3: Curriculum preference extraction
  if (!existingProfile?.curriculumPreference || existingProfile.curriculumPreference.length === 0) {
    const curriculumKeywords = message.match(/\b(montessori|waldorf|reggio|IB|international\s+baccalaureate|AP|advanced\s+placement|french\s+immersion|STEM)\b/gi);
    if (curriculumKeywords) {
      const normalized = curriculumKeywords.map(k => {
        const lower = k.toLowerCase();
        if (lower === 'international baccalaureate') return 'IB';
        if (lower === 'advanced placement') return 'AP';
        if (lower === 'french immersion') return 'French Immersion';
        return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
      });
      bridgeProfile.curriculumPreference = [...new Set(normalized)];
    }
  }

  // S111-WC3: Dealbreakers extraction (negation-anchored)
  const dealbreakers: any[] = [];
  const negReligious = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?(?:religious|religion|faith[- ]based)/i;
  if (negReligious.test(message)) dealbreakers.push('religious');
  const negSingleSex = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?(?:single[- ]sex|all[- ]boys|all[- ]girls|boys[- ]only|girls[- ]only)/i;
  if (negSingleSex.test(message)) dealbreakers.push('single-sex');
  const negBoarding = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?boarding/i;
  if (negBoarding.test(message)) dealbreakers.push('boarding');
  const negUniform = /(?:don'?t\s+want|no|not|avoid|never|without)\s+(?:a\s+)?uniform/i;
  if (negUniform.test(message)) dealbreakers.push('uniform');
  if (dealbreakers.length > 0) {
    bridgeProfile.dealbreakers = dealbreakers;
  }

  // S111-WC3: School type extraction
  if (!existingProfile?.schoolTypeLabel) {
    if (/\b(?:co-?ed|coed)\b/i.test(message)) bridgeProfile.schoolTypeLabel = 'co-ed';
    else if (/\ball[- ]?boys\b/i.test(message)) bridgeProfile.schoolTypeLabel = 'all-boys';
    else if (/\ball[- ]?girls\b/i.test(message)) bridgeProfile.schoolTypeLabel = 'all-girls';
  }

  // S111-WC3: Interests extraction (verb-anchored)
  const INTEREST_KEYWORDS = 'art|arts|music|sports|athletics|drama|theatre|theater|science|coding|robotics|swimming|hockey|soccer|basketball|dance|piano|guitar|reading|writing|math';
  const interestVerbPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+(${INTEREST_KEYWORDS})\\b`, 'gi');
  const interestListPattern = new RegExp(`\\b(?:interests?|hobbies|activities)\\s*:?\\s*((?:(?:${INTEREST_KEYWORDS})(?:\\s*,\\s*|\\s+and\\s+|\\s+))+(?:${INTEREST_KEYWORDS}))`, 'gi');
  const foundInterests = new Set();
  let iMatch;
  while ((iMatch = interestVerbPattern.exec(message)) !== null) {
    foundInterests.add(iMatch[1].toLowerCase());
  }
  const interestVerbListPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+((?:(?:${INTEREST_KEYWORDS})(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+))*(?:${INTEREST_KEYWORDS}))`, 'gi');
  while ((iMatch = interestVerbListPattern.exec(message)) !== null) {
    const items = iMatch[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  while ((iMatch = interestListPattern.exec(message)) !== null) {
    const items = iMatch[1].split(/\s*,\s*|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  const interestCommaPattern = new RegExp(`\\b(?:loves?|likes?|enjoys?|plays?|interested\\s+in|passionate\\s+about|into)\\s+(.+?)(?:[.!?]|$)`, 'gi');
  let cMatch;
  while ((cMatch = interestCommaPattern.exec(message)) !== null) {
    const items = cMatch[1].split(/\s*,\s*|\s+and\s+/);
    items.forEach(item => {
      const trimmed = item.trim().toLowerCase();
      if (new RegExp(`^(?:${INTEREST_KEYWORDS})$`).test(trimmed)) {
        foundInterests.add(trimmed);
      }
    });
  }
  if (foundInterests.size > 0) {
    bridgeProfile.interests = Array.from(foundInterests);
  }

  // Intent detection
  if (/\b(brief|summary|that'?s all|that'?s it)\b/i.test(message)) bridgeIntent = 'request-brief';
  else if (/\b(that looks right|show me schools|looks good|looks right|confirmed?|yes please)\b/i.test(message)) bridgeIntent = 'confirm-brief';

  return { bridgeProfile, bridgeIntent };
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TIMEOUT_MS = 25000;

Deno.serve(async (req) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  );

  const processRequest = async () => {
    try {
      const base44 = createClientFromRequest(req);
      const { 
        message, 
        intent, 
        schools, 
        conversationHistory, 
        conversationContext,
        userNotes,
        shortlistedSchools,
        familyProfileData
      } = await req.json();

      // Handle GENERATE_BRIEF intent
      if (intent === 'GENERATE_BRIEF' && familyProfileData) {
        const { childName, childGrade, locationArea, budgetRange, maxTuition, interests, priorities, dealbreakers, currentSituation, academicStrengths } = familyProfileData;
        
        const briefPrompt = `You are a warm, empathetic education consultant. Generate "The Brief" - a reflection message that mirrors back EXACTLY what you heard from a parent about their child and family needs.

CRITICAL: Use ONLY the actual data provided below. DO NOT invent or hallucinate any details that are not listed.

ACTUAL FAMILY DATA:
- Child's Name: ${childName || 'Not shared'}
- Grade Level: ${childGrade ? `Grade ${childGrade}` : 'Not specified'}
- Location/Area: ${locationArea || 'Not specified'}
- Current School Situation: ${currentSituation || 'Not shared'}
- Child's Academic Strengths: ${academicStrengths?.length > 0 ? academicStrengths.join(', ') : 'Not specified'}
- Child's Interests: ${interests?.length > 0 ? interests.join(', ') : 'Not specified'}
- Family Priorities: ${priorities?.length > 0 ? priorities.join(', ') : 'Not specified'}
- Budget Range: ${budgetRange || 'Not specified'}${maxTuition ? ` (up to $${maxTuition}/year)` : ''}
- Dealbreakers: ${dealbreakers?.length > 0 ? dealbreakers.join(', ') : 'None mentioned'}

GENERATE THE BRIEF:
1. Warm opening: "Here's what I'm taking away from what you've shared..."
2. Reflect back the EXACT details they mentioned - use their words when possible (e.g., if they said "art and drama" say "art and drama", not "STEM").
3. Acknowledge what you understand about their family's needs and constraints.
4. Set realistic expectations: "Given a budget of $${maxTuition || budgetRange} in the ${locationArea} area, here's what we're working with..."
5. End with: "Does that match what you're looking for? Anything I'm missing or that needs adjustment?"

ABSOLUTE RULES:
- ONLY reflect data they actually provided. NO assumptions or hallucination.
- If something is blank/not specified, say "You haven't mentioned..." - do NOT invent details.
- If they said "art and drama" - say "art and drama" (NOT "STEM" or "science and math").
- If they said "Leaside" - say "Leaside" (NOT "downtown").
- If they said "$28K" - reflect "$28K" (NOT "$20-25K").
- NO school names or recommendations - this is reflection only.
- Keep to 2-3 warm, concise paragraphs.`;

        try {
          const briefResult = await base44.integrations.Core.InvokeLLM({
            prompt: briefPrompt,
            add_context_from_internet: false
          });
          
          return Response.json({
            message: briefResult
          });
        } catch (error) {
          console.error('Brief generation error:', error);
          return Response.json({
            message: `Here's what I'm taking away: ${childName ? `${childName} is in Grade ${childGrade}` : `Your child is in Grade ${childGrade}`}${currentSituation ? ` and ${currentSituation}` : ''}. Your family is looking in the ${locationArea} area${budgetRange || maxTuition ? ` with a budget of ${maxTuition ? `$${maxTuition}/year` : budgetRange}` : ''}${interests?.length > 0 ? `, and ${childName || 'they'} is interested in ${interests.join(', ')}` : ''}. Does that capture it? Anything I should adjust?`
          });
        }
      }

      // HALLUCINATION FIX: If no schools, return "no matches" message immediately without AI call
      if (!schools || schools.length === 0) {
        return Response.json({
          message: "I don't have any schools in our database that match your criteria yet. Our database is growing - please try a nearby city or broader search criteria."
        });
      }

      const context = conversationContext || {};
      const history = conversationHistory || [];

      // Format grade helper
      function formatGrade(grade) {
        if (grade === null || grade === undefined) return '';
        const num = Number(grade);
        if (num <= -2) return 'PK';
        if (num === -1) return 'JK';
        if (num === 0) return 'K';
        return String(num);
      }

      function formatGradeRange(gradeFrom, gradeTo) {
        const from = formatGrade(gradeFrom);
        const to = formatGrade(gradeTo);
        if (!from && !to) return '';
        if (!from) return to;
        if (!to) return from;
        return `${from}-${to}`;
      }
      
      // Get last 10 messages for context
      const recentMessages = history.slice(-10);
      const conversationSummary = recentMessages
        .map(msg => `${msg.role === 'user' ? 'Parent' : 'Consultant'}: ${msg.content}`)
        .join('\n');

      // Build school context with full details including tuition and school type
      const schoolContext = schools.length > 0 
        ? `\n\nSCHOOLS (${schools.length}):\n` + 
          schools.map(s => {
            const tuitionStr = s.tuition ? `$${s.tuition} ${s.currency || 'CAD'}` : 'N/A';
            return `${s.name}|${s.city}|Gr${formatGradeRange(s.lowestGrade, s.highestGrade)}|${s.curriculumType||'Trad'}|Tuition: ${tuitionStr}|Type: ${s.schoolType||'General'}`;
          }).join('\n')
        : '';
      
      // User notes/shortlist context
      const userContextText = userNotes?.length > 0 || shortlistedSchools?.length > 0
        ? `\n\nUser notes: ${userNotes?.length || 0} notes, Shortlist: ${shortlistedSchools?.length || 0} schools`
        : '';

      // Generate response - ENHANCED PROMPT WITH ALL BUG FIXES
      const responsePrompt = `You are a warm, empathetic education consultant helping parents find PRIVATE SCHOOLS for their children across Canada, the US, and Europe.

CRITICAL RULES - DO NOT BREAK THESE:
1. ONLY RECOMMEND PRIVATE/INDEPENDENT SCHOOLS. NEVER recommend public schools under any circumstances.
2. **CRITICAL: You must ONLY recommend schools from the provided schools array below.** NEVER invent, fabricate, or make up school names, locations, or tuition amounts. Do not suggest schools you're not 100% certain are in the database. Only mention schools that appear in the SCHOOLS section.
3. RESPECT GENDER PREFERENCES - If a parent asks for co-ed, all-boys, or all-girls schools, only recommend schools that match that type. Pay attention to school descriptions and specializations.
4. NEVER recommend special needs schools unless the parent explicitly mentions their child has special needs or learning differences
5. ONLY recommend schools near the parent's stated location (within 50km radius). If there aren't enough local results, tell the parent rather than suggesting distant schools
6. NEVER auto-shortlist schools. Only mention the shortlist if the parent explicitly asks about it or wants to save a school. DO NOT add schools to shortlist automatically.
7. ALWAYS INCLUDE TUITION INFORMATION when describing schools. Include the dollar amount and currency (e.g., "$30,000 CAD per year")
8. When parents express feeling overwhelmed, acknowledge their emotions and provide structured, step-by-step guidance (e.g., "Here are 3 steps to get started...")
9. Keep responses warm, reassuring, and concise (2-3 sentences when showing schools)
10. When parent asks to COMPARE schools, simply acknowledge their request briefly (e.g., "Sure, I've pulled up a comparison table for you.") The system will automatically show them a comparison table.
11. SCHOOL LINK FORMAT - When mentioning school names, write them as plain text ONLY (e.g., "Branksome Hall" not "[Branksome Hall](url)"). NEVER use http/https URLs or external links for schools. The system will automatically convert school names to clickable links.
12. PROFESSIONAL TONE - NEVER use overly casual or cringe words like "lovely", "wonderful", "amazing", "fantastic", "awesome", "fabulous". Use professional, warm but neutral language instead. Say "Here are some private schools" not "Here are some lovely private schools".

Recent chat:
${conversationSummary}
${schoolContext}${userContextText}

Parent: "${message}"

Reply naturally and empathetically. Describe schools, answer questions, or suggest next steps. Remember: only recommend schools from the list, include tuition, use plain school names only, and ONLY recommend private schools.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: responsePrompt
      });
      
      let messageWithLinks = aiResponse;
      
      // Replace school names with school:slug links
      if (schools.length > 0) {
        // First: Convert any existing markdown links [SchoolName](url) to school:slug format
        // This handles cases where AI might generate [SchoolName](https://...) despite instructions
        schools.forEach(school => {
          const escapedName = school.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const markdownLinkRegex = new RegExp(`\\[${escapedName}\\]\\([^)]+\\)`, 'gi');
          messageWithLinks = messageWithLinks.replace(
            markdownLinkRegex,
            `[${school.name}](school:${school.slug})`
          );
        });
        
        // Second: Convert plain school names to school:slug links (if not already a link)
        schools.forEach(school => {
          const escapedName = school.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const schoolNameRegex = new RegExp(`(?<!\\[)\\b${escapedName}\\b(?!\\]\\()`, 'gi');
          messageWithLinks = messageWithLinks.replace(
            schoolNameRegex,
            `[${school.name}](school:${school.slug})`
          );
        });
      }

      return Response.json({
        message: messageWithLinks
      });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  };

  try {
    return await Promise.race([processRequest(), timeoutPromise]);
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      return Response.json({ 
        message: 'Here are the schools I found:',
        timeout: true 
      });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});
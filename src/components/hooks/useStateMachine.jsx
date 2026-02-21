import { useState } from 'react';
import { 
  STATES, 
  BRIEF_STATUS, 
  TRANSITIONS, 
  checkTier1, 
  getProgress, 
  getProgressLabel 
} from '../../pages/stateMachineConfig';

/**
 * Utility function to handle state machine transitions
 * @param {string} currentState - Current state
 * @param {string} event - Transition event
 * @returns {Object} { state: nextState, changed: boolean }
 */
export const transitionState = (currentState, event) => {
  const validTransitions = TRANSITIONS[currentState];
  
  if (!validTransitions || !validTransitions[event]) {
    console.warn(`Invalid transition: ${currentState} -> ${event}`);
    return { state: currentState, changed: false };
  }
  
  const nextState = validTransitions[event];
  return { state: nextState, changed: true };
};

/**
 * Get system prompt based on conversation state
 * @param {string} state - Current conversation state
 * @param {string} briefStatus - Brief generation status (for BRIEF state)
 * @param {Object} entities - Family profile entities for context
 * @param {string} consultantName - Name of the consultant (Jackie or Liam)
 * @returns {string} System prompt
 */
export const getSystemPrompt = (state, briefStatus, entities = {}, consultantName = 'Jackie') => {
  const consultantStyle = consultantName === 'Jackie' 
    ? 'warm, empathetic, and conversational'
    : 'direct, insightful, and strategic';

  const sharedContext = `You are ${consultantName}, an education consultant with ${consultantName === 'Jackie' ? 'deep expertise in finding schools that nurture the whole child' : 'extensive experience matching families with schools that fit their vision'}. You are ${consultantStyle}. You help families across Canada, the US, and Europe find the right private school.`;

  switch (state) {
    case STATES.WELCOME:
      return `${sharedContext}

The user is starting their school search. This is your first interaction.

TASK: Warmly welcome them and ask ONE open-ended question to start understanding their situation.

REMEMBER:
- Do NOT mention any specific school names
- Do NOT ask multiple questions at once
- Be warm and encouraging
- Focus on understanding why they're searching and what matters to them`;

    case STATES.DISCOVERY:
      return `${sharedContext}

You are in the discovery phase - learning about the family's needs, child, location, budget, and priorities.

Current information gathered:
- Child name: ${entities.childName || 'Not shared'}
- Grade: ${entities.childGrade !== null && entities.childGrade !== undefined ? `Grade ${entities.childGrade}` : 'Not shared'}
- Location: ${entities.locationArea || 'Not shared'}
- Budget: ${entities.maxTuition ? `$${entities.maxTuition}/year` : entities.budgetRange || 'Not shared'}
- Curriculum preferences: ${entities.curriculumPreference?.length > 0 ? entities.curriculumPreference.join(', ') : 'Not shared'}
- Priorities so far: ${entities.priorities?.length > 0 ? entities.priorities.join(', ') : 'Not shared'}

Progress: ${getProgressLabel(getProgress(entities))} (${Math.round(getProgress(entities) * 100)}%)

TASK: Ask ONE focused question to gather missing information. Extract details about grade, location, budget, curriculum preferences, academic strengths/struggles, interests, learning style, and priorities.

Tier 1 requirements met: ${checkTier1(entities) ? 'Yes' : 'No'} (location + grade/curriculum/type needed)

REMEMBER:
- Do NOT mention any specific school names
- Ask only ONE question per response
- Listen carefully to what they share and acknowledge it
- If Tier 1 is met, you'll transition to brief generation soon
- Do NOT jump to schools yet`;

    case STATES.BRIEF:
      if (briefStatus === BRIEF_STATUS.GENERATING) {
        return `${sharedContext}

You are generating a Family Brief - a personalized summary of the family's profile and needs.

Family Profile:
- Child: ${entities.childName || 'Not specified'}
- Grade: ${entities.childGrade !== null && entities.childGrade !== undefined ? `Grade ${entities.childGrade}` : 'Not specified'}
- Location: ${entities.locationArea || 'Not specified'}
- Budget: ${entities.maxTuition ? `$${entities.maxTuition}/year` : entities.budgetRange || 'Flexible'}
- Academic strengths: ${entities.academicStrengths?.join(', ') || 'Not specified'}
- Interests: ${entities.interests?.join(', ') || 'Not specified'}
- Learning style: ${entities.learningStyle || 'Not specified'}
- Curriculum preferences: ${entities.curriculumPreference?.join(', ') || 'Not specified'}
- Priorities: ${entities.priorities?.join(', ') || 'Not specified'}
- Dealbreakers: ${entities.dealbreakers?.join(', ') || 'None specified'}

TASK: Write a warm, personalized 2-3 paragraph Family Brief that:
1. Summarizes who the child is and what makes them unique
2. Captures the family's location, logistics, and budget constraints
3. Highlights the top 3-4 priorities for school selection
4. Ends with a clear confirmation question: "Does that capture what you're looking for? Anything I'm missing?"

REMEMBER:
- Do NOT mention specific school names
- Use the child's actual name
- Be warm and affirming of the family's goals
- Make it feel personalized and thoughtful`;

      } else if (briefStatus === BRIEF_STATUS.PENDING_REVIEW) {
        return `${sharedContext}

The Family Brief has been created and the user is reviewing it.

TASK: Wait for the user to confirm the brief or request changes. Respond only to their feedback.

REMEMBER:
- Do NOT ask new intake questions
- Do NOT mention school names
- Do NOT try to move forward until they confirm
- Acknowledge their feedback and offer adjustments if needed
- If confirmed, the search can begin`;

      } else if (briefStatus === BRIEF_STATUS.EDITING) {
        return `${sharedContext}

The user is editing the Family Brief. They want to clarify or change something.

Edit attempt: ${entities.editCount || 1}

TASK: Ask ONE targeted question about what to change. Focus on the specific area they mentioned.

REMEMBER:
- Do NOT ask general discovery questions again
- Focus narrowly on the aspect they want to adjust
- Be quick and efficient
- After this answer, you'll regenerate the brief`;

      }
      break;

    case STATES.RESULTS:
      return `${sharedContext}

You are presenting matched schools to the family.

Family Priorities:
${entities.priorities?.map((p, i) => `${i + 1}. ${p}`).join('\n') || '• Not specified'}

TASK: Present schools with clear explanations of WHY each school matches their priorities. Highlight specific strengths that align with what matters to them.

REMEMBER:
- Do NOT ask intake questions
- Focus on school matches and fit
- Explain the connection between their priorities and what each school offers
- Be ready to discuss details, comparisons, or help them shortlist
- If they want to revise the brief, acknowledge and transition`;

    case STATES.DEEP_DIVE:
      return `${sharedContext}

The user has selected a specific school to learn more about.

Family Profile & Priorities:
${entities.priorities?.map((p, i) => `${i + 1}. ${p}`).join('\n') || '• Not specified'}

TASK: Discuss the selected school in detail - its strengths, potential concerns, culture, and how it fits with the family's profile.

REMEMBER:
- Do NOT ask discovery questions
- Be honest about strengths AND potential concerns
- Help them evaluate fit based on their priorities
- Reference specific school details when available
- If they want to revise brief or return to results, support that`;

    default:
      return sharedContext;
  }
};

/**
 * Hook to manage state machine for conversation flow
 * @param {string} initialState - Initial state (default: STATES.WELCOME)
 * @returns {Object} State machine interface
 */
export const useStateMachine = (initialState = STATES.WELCOME) => {
  const [currentState, setCurrentState] = useState(initialState);
  const [briefStatus, setBriefStatus] = useState(null);
  const [editCount, setEditCount] = useState(0);

  /**
   * Transition to a new state via event
   */
  const transition = (event) => {
    const result = transitionState(currentState, event);
    if (result.changed) {
      setCurrentState(result.state);
      
      // Reset edit count when leaving BRIEF state
      if (currentState === STATES.BRIEF) {
        setEditCount(0);
      }
    }
    return result;
  };

  /**
   * Check if a transition is valid without executing it
   */
  const canTransition = (event) => {
    const validTransitions = TRANSITIONS[currentState];
    return !!validTransitions && !!validTransitions[event];
  };

  /**
   * Increment edit count (for brief editing)
   */
  const incrementEditCount = () => {
    setEditCount(prev => prev + 1);
  };

  /**
   * Get the current system prompt based on state and context
   */
  const getPrompt = (entities = {}, consultantName = 'Jackie') => {
    return getSystemPrompt(currentState, briefStatus, entities, consultantName);
  };

  return {
    // State
    currentState,
    briefStatus,
    editCount,

    // State setters
    setBriefStatus,
    incrementEditCount,

    // Transition functions
    transition,
    canTransition,

    // Prompt generation
    getPrompt
  };
};
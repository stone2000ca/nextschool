/**
 * School Admin Chat — AI agent backend for the school admin chat pane
 * E54-S6: Accepts user messages + school context, returns agent reply
 * with optional structured change sets for profile edits.
 */

import { invokeLLM } from '@/lib/integrations'
import { School } from '@/lib/entities-server'
import { ENRICHABLE_FIELDS } from '@/lib/agents/schoolAgent'

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProposedChange {
  field: string
  oldValue: any
  newValue: any
}

export interface SchoolAdminChatRequest {
  message: string
  conversationHistory?: ChatMessage[]
  context?: {
    activeSection?: string
    sectionFields?: string[]
  }
}

export interface SchoolAdminChatResponse {
  reply: string
  changes?: ProposedChange[]
}

// ─── Field label map (for human-readable LLM output) ────────────────

const FIELD_LABELS: Record<string, string> = {
  name: 'School Name',
  description: 'Description',
  day_tuition: 'Day Tuition',
  boarding_tuition: 'Boarding Tuition',
  enrollment: 'Enrollment',
  avg_class_size: 'Avg Class Size',
  student_teacher_ratio: 'Student:Teacher Ratio',
  curriculum: 'Curriculum',
  address: 'Address',
  city: 'City',
  province_state: 'Province/State',
  country: 'Country',
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  mission_statement: 'Mission Statement',
  teaching_philosophy: 'Teaching Philosophy',
  specializations: 'Specializations',
  arts_programs: 'Arts Programs',
  sports_programs: 'Sports Programs',
  clubs: 'Clubs & Activities',
  languages: 'Languages',
  faith_based: 'Faith Based',
  gender_policy: 'Gender Policy',
  school_type_label: 'School Type',
  facilities: 'Facilities',
  financial_aid_available: 'Financial Aid Available',
  financial_aid_details: 'Financial Aid Details',
  day_admission_deadline: 'Admission Deadline',
  admission_requirements: 'Admission Requirements',
  entrance_requirements: 'Entrance Requirements',
  lowest_grade: 'Lowest Grade',
  highest_grade: 'Highest Grade',
}

// ─── System prompt builder ──────────────────────────────────────────

function buildSystemPrompt(school: any, context?: SchoolAdminChatRequest['context']): string {
  const enrichableList = Array.from(ENRICHABLE_FIELDS).join(', ')

  // Build a summary of current school data for relevant fields
  const currentData: Record<string, any> = {}
  for (const field of ENRICHABLE_FIELDS) {
    const val = school[field]
    if (val !== null && val !== undefined && val !== '') {
      currentData[field] = val
    }
  }

  let contextHint = ''
  if (context?.activeSection) {
    contextHint = `\nThe user is currently viewing the "${context.activeSection}" section of their profile. Focus your responses on fields related to this area when relevant.`
    if (context.sectionFields?.length) {
      contextHint += ` Relevant fields: ${context.sectionFields.join(', ')}.`
    }
  }

  return `You are the NextSchool Account Manager, an AI assistant helping school administrators manage their school profile on the NextSchool platform.

School: "${school.name}" (ID: ${school.id})

Current profile data:
${JSON.stringify(currentData, null, 2)}

Enrichable fields: ${enrichableList}
${contextHint}

## Your capabilities:
1. Answer questions about the school's profile data
2. Propose changes to profile fields when the user asks for updates
3. Rephrase or improve text fields like mission statements and descriptions
4. Explain what each field means and how it affects search visibility

## Response format:
You MUST respond with valid JSON matching this schema:
{
  "reply": "Your conversational response to the user",
  "changes": [
    {
      "field": "the_field_name",
      "oldValue": <current value or null>,
      "newValue": <proposed new value>
    }
  ]
}

Rules:
- "reply" is always required — a friendly, helpful message
- "changes" is optional — only include when the user asks to update, change, or improve a field
- Only propose changes for fields in the enrichable fields list
- For numeric fields (tuition, enrollment, etc.), use numbers not strings
- For array fields (curriculum, specializations, etc.), use arrays
- For boolean fields, use true/false
- When rephrasing text, show your proposed version in the reply AND include it as a change
- If the user's request is unclear, ask clarifying questions — do NOT guess
- Keep replies concise and professional
- Never fabricate data the user hasn't provided or asked for`
}

// ─── Main function ──────────────────────────────────────────────────

export async function schoolAdminChat(
  schoolId: string,
  request: SchoolAdminChatRequest,
): Promise<SchoolAdminChatResponse> {
  if (!schoolId) {
    throw Object.assign(new Error('schoolId is required'), { status: 400 })
  }
  if (!request.message?.trim()) {
    throw Object.assign(new Error('message is required'), { status: 400 })
  }

  // Fetch current school data
  const school = await School.get(schoolId)
  if (!school) {
    throw Object.assign(new Error('School not found'), { status: 404 })
  }

  // Build conversation messages for the LLM
  const systemPrompt = buildSystemPrompt(school, request.context)
  const history = request.conversationHistory || []

  // Build a single prompt with conversation history
  let fullPrompt = `SYSTEM:\n${systemPrompt}\n\n`

  for (const msg of history.slice(-10)) {
    fullPrompt += `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}:\n${msg.content}\n\n`
  }
  fullPrompt += `USER:\n${request.message}\n\nRespond with valid JSON only.`

  const rawResponse = await invokeLLM({
    prompt: fullPrompt,
    response_json_schema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              oldValue: {},
              newValue: {},
            },
            required: ['field', 'newValue'],
          },
        },
      },
      required: ['reply'],
      additionalProperties: false,
    },
  })

  // Parse response
  let parsed: any
  if (typeof rawResponse === 'string') {
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      // LLM returned non-JSON — treat as plain reply
      return { reply: rawResponse }
    }
  } else {
    parsed = rawResponse
  }

  const reply = parsed.reply || 'I apologize, I had trouble processing that. Could you rephrase?'

  // Validate and filter changes
  let changes: ProposedChange[] | undefined
  if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
    changes = parsed.changes
      .filter((c: any) => c.field && ENRICHABLE_FIELDS.has(c.field))
      .map((c: any) => ({
        field: c.field,
        oldValue: school[c.field] ?? null,
        newValue: c.newValue,
      }))

    if (changes.length === 0) {
      changes = undefined
    }
  }

  return { reply, changes }
}

/** Get a human-readable label for a field name */
export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

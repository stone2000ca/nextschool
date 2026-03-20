/**
 * TypeScript types for Conversation & Session API request/response bodies
 */

// ─── Conversation types ─────────────────────────────────────────────

export interface Conversation {
  id: string
  user_id: string
  title: string
  messages: any[]
  conversation_context: Record<string, any>
  is_active: boolean
  starred: boolean
  journey_id?: string | null
  long_term_summary?: string | null
  short_term_context?: string | null
  archived_messages?: any[] | null
  created_date?: string
  updated_at?: string
}

export interface CreateConversationInput {
  user_id: string
  title: string
  messages: any[]
  conversation_context?: Record<string, any>
  is_active?: boolean
}

export interface UpdateConversationInput {
  title?: string
  messages?: any[]
  conversation_context?: Record<string, any>
  is_active?: boolean
  starred?: boolean
  journey_id?: string | null
  long_term_summary?: string | null
  short_term_context?: string | null
  archived_messages?: any[] | null
}

// ─── Session types ──────────────────────────────────────────────────

export interface ChatSessionRecord {
  id: string
  session_token?: string
  user_id: string
  family_profile_id?: string | null
  chat_history_id?: string | null
  status: string
  consultant_selected?: string | null
  child_name?: string | null
  child_grade?: number | null
  location_area?: string | null
  max_tuition?: number | null
  priorities?: string[] | null
  learning_differences?: string[] | null
  matched_schools?: string | null
  profile_name?: string | null
  journey_id?: string | null
  share_token?: string | null
  shortlisted_count?: number | null
  ai_narrative?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateSessionInput {
  session_token: string
  user_id: string
  family_profile_id?: string | null
  chat_history_id?: string | null
  status: string
  consultant_selected?: string | null
  child_name?: string | null
  child_grade?: number | null
  location_area?: string | null
  max_tuition?: number | null
  priorities?: string[] | null
  matched_schools?: string | null
  profile_name?: string | null
  journey_id?: string | null
}

export interface UpdateSessionInput {
  status?: string
  is_active?: boolean
  share_token?: string | null
  shortlisted_count?: number | null
  matched_schools?: string | null
  child_name?: string | null
  child_grade?: number | null
  location_area?: string | null
  max_tuition?: number | null
  priorities?: string[] | null
  learning_differences?: string[] | null
  profile_name?: string | null
  journey_id?: string | null
  ai_narrative?: string | null
}

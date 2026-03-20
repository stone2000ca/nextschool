/**
 * Entity data access layer (client-side)
 * Wraps Supabase queries — callers must use snake_case field names directly
 */
import { createClient } from '@/lib/supabase/client'

// ─── Entity → Table mapping ─────────────────────────────────────────

const TABLE_MAP: Record<string, string> = {
  ChatHistory: 'conversations',
  ChatSession: 'chat_sessions',
  ChatShortlist: 'chat_shortlists',
  FamilyProfile: 'family_profiles',
  FamilyJourney: 'family_journeys',
  SchoolJourney: 'school_journeys',
  School: 'schools',
  SchoolAnalysis: 'school_analyses',
  SchoolEvent: 'school_events',
  SchoolClaim: 'school_claims',
  SchoolAdmin: 'school_admins',
  SchoolInquiry: 'school_inquiries',
  GeneratedArtifact: 'generated_artifacts',
  User: 'user_profiles',
  UserMemory: 'user_memories',
  Blog: 'blog_posts',
  BlogPost: 'blog_posts',
  BetaFeedback: 'feedback',
  Feedback: 'feedback',
  Submission: 'submissions',
  Claim: 'school_claims',
  DisputeRequest: 'disputes',
  SessionEvent: 'session_events',
  TokenTransaction: 'token_transactions',
  SharedShortlist: 'shared_shortlists',
  Testimonial: 'testimonials',
  TourRequest: 'tour_requests',
  Notes: 'notes',
  ResearchNote: 'notes',
  EmailLog: 'email_logs',
  LLMLog: 'llm_logs',
  SearchLog: 'search_logs',
  ConversationSummary: 'conversation_summaries',
  PhotoCandidate: 'photo_candidates',
  EnrichmentDiff: 'enrichment_diffs',
  ImportRun: 'import_runs',
  VisitorLog: 'visitor_logs',
  UserTokenBalance: 'user_profiles',
  ConversationState: 'conversation_state',
  ConversationSchools: 'conversation_schools',
  ConversationArtifacts: 'conversation_artifacts',
  MatchExplanationCache: 'match_explanation_cache',
  VisitRecord: 'visit_records',
  UnsubscribeToken: 'unsubscribe_tokens',
}

function getTableName(entityName: string): string {
  return TABLE_MAP[entityName] || entityName.toLowerCase() + 's'
}

// ─── Filter translation ─────────────────────────────────────────────
// Translates legacy filter syntax to Supabase query builder calls

function applyFilters(query: any, filterObj: Record<string, any>) {
  for (const [key, value] of Object.entries(filterObj)) {
    if (value === null || value === undefined) {
      query = query.is(key, null)
    } else if (Array.isArray(value)) {
      query = query.in(key, value)
    } else if (typeof value === 'object' && value !== null) {
      if ('$in' in value) {
        query = query.in(key, value.$in)
      }
      if ('$contains' in value) {
        query = query.contains(key, Array.isArray(value.$contains) ? value.$contains : [value.$contains])
      }
      if ('$gte' in value) {
        query = query.gte(key, value.$gte)
      }
      if ('$lte' in value) {
        query = query.lte(key, value.$lte)
      }
      if ('$ne' in value) {
        query = query.neq(key, value.$ne)
      }
      if ('$regex' in value) {
        query = query.ilike(key, `%${value.$regex}%`)
      }
    } else {
      query = query.eq(key, value)
    }
  }
  return query
}

function applySortString(query: any, sort: string) {
  if (!sort) return query
  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort
  return query.order(field, { ascending: !descending })
}

// ─── Entity client factory ───────────────────────────────────────────

export interface EntityClient {
  list(sort?: string, filter?: Record<string, any>, limit?: number): Promise<any[]>
  get(id: string): Promise<any>
  create(data: Record<string, any>): Promise<any>
  update(id: string, data: Record<string, any>): Promise<any>
  delete(id: string): Promise<void>
  filter(filterObj: Record<string, any>, sort?: string, limit?: number): Promise<any[]>
}

function createEntity(entityName: string): EntityClient {
  const table = getTableName(entityName)

  // Helper to get a typed query builder for dynamic table names
  const db = () => createClient().from(table) as any

  return {
    async filter(filterObj: Record<string, any> = {}, sort?: string, limit?: number): Promise<any[]> {
      let query = db().select('*')
      query = applyFilters(query, filterObj)
      if (sort) query = applySortString(query, sort)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async list(sort?: string, filter?: Record<string, any>, limit?: number): Promise<any[]> {
      return this.filter(filter || {}, sort, limit)
    },

    async get(id: string): Promise<any> {
      const { data, error } = await db().select('*').eq('id', id).single()
      if (error) throw error
      return data
    },

    async create(data: Record<string, any>): Promise<any> {
      const row = { ...data, updated_at: new Date().toISOString() }
      const { data: result, error } = await db().insert(row).select().single()
      if (error) throw error
      return result
    },

    async update(id: string, data: Record<string, any>): Promise<any> {
      const row = { ...data, updated_at: new Date().toISOString() }
      const { data: result, error } = await db().update(row).eq('id', id).select().single()
      if (error) throw error
      return result
    },

    async delete(id: string): Promise<void> {
      const { error } = await db().delete().eq('id', id)
      if (error) throw error
    },
  }
}

// ─── Entity exports (all 33+) ────────────────────────────────────────

export const ChatHistory = createEntity('ChatHistory')
export const ChatSession = createEntity('ChatSession')
export const ChatShortlist = createEntity('ChatShortlist')
export const FamilyProfile = createEntity('FamilyProfile')
export const FamilyJourney = createEntity('FamilyJourney')
export const SchoolJourney = createEntity('SchoolJourney')
export const School = createEntity('School')
export const SchoolAnalysis = createEntity('SchoolAnalysis')
export const SchoolEvent = createEntity('SchoolEvent')
export const SchoolClaim = createEntity('SchoolClaim')
export const SchoolAdmin = createEntity('SchoolAdmin')
export const SchoolInquiry = createEntity('SchoolInquiry')
export const GeneratedArtifact = createEntity('GeneratedArtifact')
export const User = createEntity('User')
export const UserMemory = createEntity('UserMemory')
export const Blog = createEntity('Blog')
export const BlogPost = createEntity('BlogPost')
export const BetaFeedback = createEntity('BetaFeedback')
export const Feedback = createEntity('Feedback')
export const Submission = createEntity('Submission')
export const Claim = createEntity('Claim')
export const DisputeRequest = createEntity('DisputeRequest')
export const SessionEvent = createEntity('SessionEvent')
export const TokenTransaction = createEntity('TokenTransaction')
export const SharedShortlist = createEntity('SharedShortlist')
export const Testimonial = createEntity('Testimonial')
export const TourRequest = createEntity('TourRequest')
export const Notes = createEntity('Notes')
export const ResearchNote = createEntity('ResearchNote')
export const EmailLog = createEntity('EmailLog')
export const LLMLog = createEntity('LLMLog')
export const SearchLog = createEntity('SearchLog')
export const ConversationSummary = createEntity('ConversationSummary')
export const PhotoCandidate = createEntity('PhotoCandidate')
export const EnrichmentDiff = createEntity('EnrichmentDiff')
export const ImportRun = createEntity('ImportRun')
export const VisitorLog = createEntity('VisitorLog')
export const UserTokenBalance = createEntity('UserTokenBalance')
export const ConversationState = createEntity('ConversationState')
export const ConversationSchools = createEntity('ConversationSchools')
export const ConversationArtifacts = createEntity('ConversationArtifacts')
export const VisitRecord = createEntity('VisitRecord')
export const UnsubscribeToken = createEntity('UnsubscribeToken')

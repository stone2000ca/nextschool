/**
 * Entity data access layer (client-side)
 * Wraps Supabase queries with camelCase/snake_case translation
 * Translates camelCase field names to snake_case for Supabase
 */
import { createClient } from '@/lib/supabase/client'

// ─── camelCase ↔ snake_case helpers ──────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function keysToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}

function keysToCamel(obj: Record<string, any>): Record<string, any> {
  if (obj === null || obj === undefined) return obj
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value
  }
  return result
}

function rowsToCamel(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map(keysToCamel)
}

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
}

function getTableName(entityName: string): string {
  return TABLE_MAP[entityName] || entityName.toLowerCase() + 's'
}

// ─── Filter translation ─────────────────────────────────────────────
// Translates Base44 filter syntax to Supabase query builder calls

function applyFilters(query: any, filterObj: Record<string, any>) {
  for (const [key, value] of Object.entries(filterObj)) {
    const col = camelToSnake(key)

    if (value === null || value === undefined) {
      query = query.is(col, null)
    } else if (Array.isArray(value)) {
      // { field: [v1, v2] } → .in()
      query = query.in(col, value)
    } else if (typeof value === 'object' && value !== null) {
      // Operator objects
      if ('$in' in value) {
        query = query.in(col, value.$in)
      }
      if ('$contains' in value) {
        query = query.contains(col, Array.isArray(value.$contains) ? value.$contains : [value.$contains])
      }
      if ('$gte' in value) {
        query = query.gte(col, value.$gte)
      }
      if ('$lte' in value) {
        query = query.lte(col, value.$lte)
      }
      if ('$ne' in value) {
        query = query.neq(col, value.$ne)
      }
      if ('$regex' in value) {
        // Supabase ilike for case-insensitive regex-like matching
        const pattern = value.$regex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        query = query.ilike(col, `%${value.$regex}%`)
      }
    } else {
      query = query.eq(col, value)
    }
  }
  return query
}

function applySortString(query: any, sort: string) {
  if (!sort) return query
  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort
  return query.order(camelToSnake(field), { ascending: !descending })
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
      return rowsToCamel(data || [])
    },

    async list(sort?: string, filter?: Record<string, any>, limit?: number): Promise<any[]> {
      return this.filter(filter || {}, sort, limit)
    },

    async get(id: string): Promise<any> {
      const { data, error } = await db().select('*').eq('id', id).single()
      if (error) throw error
      return keysToCamel(data)
    },

    async create(data: Record<string, any>): Promise<any> {
      const snakeData = keysToSnake(data)
      const { data: result, error } = await db().insert(snakeData).select().single()
      if (error) throw error
      return keysToCamel(result)
    },

    async update(id: string, data: Record<string, any>): Promise<any> {
      const snakeData = keysToSnake(data)
      const { data: result, error } = await db().update(snakeData).eq('id', id).select().single()
      if (error) throw error
      return keysToCamel(result)
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

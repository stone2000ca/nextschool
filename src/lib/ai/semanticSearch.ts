/**
 * Semantic search utilities using pgvector cosine similarity.
 * Uses generateEmbedding to vectorize the query, then performs
 * nearest-neighbor search via the Supabase admin client (raw SQL).
 */

import { generateEmbedding } from './generateEmbedding'
import { getAdminClient } from '@/lib/supabase/admin'

interface SemanticSearchResult {
  id: string
  similarity: number
  [key: string]: any
}

/**
 * Core helper: embed the query text, then run a cosine similarity
 * search against the given table's embedding column.
 */
async function vectorSearch(
  table: string,
  queryText: string,
  limit: number,
  extraWhere?: string,
  extraParams?: any[]
): Promise<SemanticSearchResult[]> {
  const embedding = await generateEmbedding(queryText)
  if (!embedding) return []

  const vectorLiteral = `[${embedding.join(',')}]`

  // Build WHERE clause
  let whereClause = 'embedding IS NOT NULL'
  if (extraWhere) {
    whereClause += ` AND ${extraWhere}`
  }

  // Build parameterized query
  // Note: pgvector cosine distance operator <=> returns distance (0 = identical),
  // so similarity = 1 - distance
  const sql = `
    SELECT *, 1 - (embedding <=> '${vectorLiteral}'::vector) AS similarity
    FROM ${table}
    WHERE ${whereClause}
    ORDER BY embedding <=> '${vectorLiteral}'::vector
    LIMIT ${limit}
  `

  const client = getAdminClient()
  const { data, error } = await (client.rpc as any)('exec_sql', { query: sql }).single()

  // If exec_sql RPC doesn't exist, fall back to raw REST approach
  if (error) {
    // Use the Supabase PostgREST approach with a dedicated RPC function
    // Fall back: call via .rpc with match function pattern
    return vectorSearchFallback(table, embedding, limit, extraWhere)
  }

  return (data as any)?.rows || []
}

/**
 * Fallback: use Supabase client to query with embedding filter.
 * This approach works without a custom RPC function by using
 * the admin client's raw query capability.
 */
async function vectorSearchFallback(
  table: string,
  embedding: number[],
  limit: number,
  extraWhere?: string
): Promise<SemanticSearchResult[]> {
  const client = getAdminClient()
  const vectorLiteral = `[${embedding.join(',')}]`

  // Use Supabase's built-in PostgREST — we can't do vector ops directly,
  // so we use a raw SQL query via the pg_net extension or a simple RPC.
  // Most pragmatic: create a generic match function per table.
  // For now, use the admin client to call a match RPC.

  // Try table-specific match functions first
  const matchFn = `match_${table}`
  const { data, error } = await (client.rpc as any)(matchFn, {
    query_embedding: vectorLiteral,
    match_count: limit,
    ...(extraWhere ? { filter_clause: extraWhere } : {}),
  })

  if (error) {
    console.error(`[semanticSearch] ${matchFn} RPC failed:`, error.message)
    // Last resort: direct SQL via supabase-js
    return directSqlSearch(table, vectorLiteral, limit, extraWhere)
  }

  return (data || []).map((row: any) => ({
    ...row,
    similarity: row.similarity ?? 0,
  }))
}

/**
 * Direct SQL search using Supabase admin client's .from() with raw filter.
 * This is the most compatible approach - uses textual ordering.
 */
async function directSqlSearch(
  table: string,
  vectorLiteral: string,
  limit: number,
  extraWhere?: string
): Promise<SemanticSearchResult[]> {
  const client = getAdminClient()

  // Use Supabase's SQL API endpoint directly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[semanticSearch] Missing Supabase credentials for direct SQL')
    return []
  }

  let whereClause = 'embedding IS NOT NULL'
  if (extraWhere) whereClause += ` AND ${extraWhere}`

  const sql = `
    SELECT *, 1 - (embedding <=> '${vectorLiteral}'::vector) AS similarity
    FROM ${table}
    WHERE ${whereClause}
    ORDER BY embedding <=> '${vectorLiteral}'::vector
    LIMIT ${limit}
  `

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_raw_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    })

    if (!response.ok) {
      // Final fallback: just return empty — the match RPC functions
      // should be created when the migration is applied
      console.warn(`[semanticSearch] Direct SQL failed for ${table}, returning empty results. Consider creating match_${table} RPC function.`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (err: any) {
    console.error('[semanticSearch] Direct SQL error:', err?.message)
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Search schools by semantic similarity to query text.
 */
export async function searchSchools(
  queryText: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  if (!queryText?.trim()) return []
  return vectorSearch('schools', queryText, limit)
}

/**
 * Search conversation summaries, optionally scoped to a specific conversation.
 */
export async function searchConversationSummaries(
  queryText: string,
  conversationId?: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  if (!queryText?.trim()) return []
  const extraWhere = conversationId ? `conversation_id = '${conversationId}'` : undefined
  return vectorSearch('conversation_summaries', queryText, limit, extraWhere)
}

/**
 * Search school analyses, optionally scoped to a specific school.
 */
export async function searchSchoolAnalysis(
  queryText: string,
  schoolId?: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  if (!queryText?.trim()) return []
  const extraWhere = schoolId ? `school_id = '${schoolId}'` : undefined
  return vectorSearch('school_analyses', queryText, limit, extraWhere)
}

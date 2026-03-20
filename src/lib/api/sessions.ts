/**
 * Client-side fetch helpers for Session API routes
 * Replaces direct ChatSession entity calls in page-components and components
 */
import type {
  ChatSessionRecord,
  CreateSessionInput,
  UpdateSessionInput,
} from './types'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

/** GET /api/sessions — list sessions for current user */
export async function fetchSessions(): Promise<ChatSessionRecord[]> {
  const res = await fetch('/api/sessions')
  return handleResponse<ChatSessionRecord[]>(res)
}

/** POST /api/sessions — create a new session */
export async function createSession(
  data: CreateSessionInput
): Promise<ChatSessionRecord> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<ChatSessionRecord>(res)
}

/** GET /api/sessions/[id] — get a session by ID */
export async function fetchSession(
  id: string
): Promise<ChatSessionRecord> {
  const res = await fetch(`/api/sessions/${id}`)
  return handleResponse<ChatSessionRecord>(res)
}

/** PATCH /api/sessions/[id] — update session fields */
export async function updateSession(
  id: string,
  data: UpdateSessionInput
): Promise<ChatSessionRecord> {
  const res = await fetch(`/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<ChatSessionRecord>(res)
}

/** GET /api/shared/profile/[token] — public, no auth */
export async function fetchSharedProfile(
  token: string
): Promise<ChatSessionRecord> {
  const res = await fetch(`/api/shared/profile/${encodeURIComponent(token)}`)
  return handleResponse<ChatSessionRecord>(res)
}

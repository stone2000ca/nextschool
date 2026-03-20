/**
 * Client-side fetch helpers for Conversation API routes
 * Replaces direct ChatHistory entity calls in page-components and components
 */
import type {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
} from './types'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

/** GET /api/conversations — list active conversations for current user */
export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch('/api/conversations')
  return handleResponse<Conversation[]>(res)
}

/** POST /api/conversations — create a new conversation */
export async function createConversation(
  data: CreateConversationInput
): Promise<Conversation> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Conversation>(res)
}

/** GET /api/conversations/[id] — get a single conversation */
export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`)
  return handleResponse<Conversation>(res)
}

/** PATCH /api/conversations/[id] — update conversation fields */
export async function updateConversation(
  id: string,
  data: UpdateConversationInput
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Conversation>(res)
}

/** DELETE /api/conversations/[id] — soft-delete conversation */
export async function deleteConversation(
  id: string
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: 'DELETE',
  })
  return handleResponse<{ success: boolean }>(res)
}

/** GET /api/admin/conversations — list all conversations (admin-only) */
export async function fetchAdminConversations(): Promise<Conversation[]> {
  const res = await fetch('/api/admin/conversations')
  return handleResponse<Conversation[]>(res)
}

/**
 * Client-side fetch helpers for remaining entity domains.
 * Phase 2 Wave 4: Replaces all remaining direct entity imports from @/lib/entities.
 *
 * Grouped by domain: Users, SchoolAdmins, SchoolEvents, Journeys,
 * Feedback, Disputes, Memory, Logs, TourRequests, Notes, Artifacts, ConversationState.
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Users ──────────────────────────────────────────────────────────────

export async function fetchUsers(params: { id?: string; email?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.id) sp.set('id', params.id)
  if (params.email) sp.set('email', params.email)
  const qs = sp.toString()
  const res = await fetch(`/api/users${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** Admin-only: list all users */
export async function fetchAdminUsers(params: { sort?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  const res = await fetch(`/api/admin-users${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** Admin-only: update a user */
export async function updateAdminUser(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/admin-users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  })
  return handleResponse<any>(res)
}

// ── SchoolAdmins ───────────────────────────────────────────────────────

export async function fetchSchoolAdmins(params: {
  school_id?: string; user_id?: string; role?: string; is_active?: boolean
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.user_id) sp.set('user_id', params.user_id)
  if (params.role) sp.set('role', params.role)
  if (params.is_active !== undefined) sp.set('is_active', String(params.is_active))
  const qs = sp.toString()
  const res = await fetch(`/api/school-admins${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createSchoolAdmin(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/school-admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateSchoolAdmin(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/school-admins/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── SchoolEvents ───────────────────────────────────────────────────────

export async function fetchSchoolEvents(params: {
  school_id?: string; is_active?: boolean; date_gte?: string
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.is_active !== undefined) sp.set('is_active', String(params.is_active))
  if (params.date_gte) sp.set('date_gte', params.date_gte)
  const qs = sp.toString()
  const res = await fetch(`/api/school-events${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

// ── Family Profile ─────────────────────────────────────────────────────

export async function fetchFamilyProfiles(params: {
  user_id?: string; id?: string
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.user_id) sp.set('user_id', params.user_id)
  if (params.id) sp.set('id', params.id)
  const qs = sp.toString()
  const res = await fetch(`/api/family-profile${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function deleteFamilyProfile(id: string): Promise<void> {
  const res = await fetch(`/api/family-profile/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

// ── Family Journey ─────────────────────────────────────────────────────

export async function fetchFamilyJourneys(params: {
  user_id: string; sort?: string; limit?: number
} ): Promise<any[]> {
  const sp = new URLSearchParams()
  sp.set('user_id', params.user_id)
  const res = await fetch(`/api/family-journey?${sp.toString()}`)
  const data = await handleResponse<any[]>(res)
  // Client-side sort/limit for compatibility with entity .filter() calls
  if (params.sort === '-updated_date') {
    data.sort((a: any, b: any) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime())
  }
  if (params.limit) return data.slice(0, params.limit)
  return data
}

export async function updateFamilyJourney(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/family-journey', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  })
  return handleResponse<any>(res)
}

// ── School Journey ─────────────────────────────────────────────────────

export async function fetchSchoolJourneys(params: {
  family_journey_id?: string; school_id?: string
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.family_journey_id) sp.set('family_journey_id', params.family_journey_id)
  if (params.school_id) sp.set('school_id', params.school_id)
  const qs = sp.toString()
  const res = await fetch(`/api/school-journeys${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createSchoolJourney(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/school-journeys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateSchoolJourney(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/school-journeys/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── BetaFeedback ───────────────────────────────────────────────────────

export async function fetchBetaFeedback(params: { sort?: string; limit?: number } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.sort) sp.set('sort', params.sort)
  if (params.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  const res = await fetch(`/api/beta-feedback${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createBetaFeedback(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/beta-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── DisputeRequests ────────────────────────────────────────────────────

export async function fetchDisputeRequests(params: { status?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  const qs = sp.toString()
  const res = await fetch(`/api/dispute-requests${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createDisputeRequest(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/dispute-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateDisputeRequest(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/dispute-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── UserMemory ─────────────────────────────────────────────────────────

export async function fetchUserMemory(params: { user_id?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.user_id) sp.set('user_id', params.user_id)
  const qs = sp.toString()
  const res = await fetch(`/api/user-memory${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createUserMemory(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/user-memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateUserMemory(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/user-memory/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function deleteUserMemory(id: string): Promise<void> {
  const res = await fetch(`/api/user-memory/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

// ── EmailLog ───────────────────────────────────────────────────────────

export async function fetchEmailLogs(params: { is_test?: boolean } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.is_test !== undefined) sp.set('is_test', String(params.is_test))
  const qs = sp.toString()
  const res = await fetch(`/api/email-logs${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createEmailLog(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/email-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── LLMLog ─────────────────────────────────────────────────────────────

export async function fetchLLMLogs(params: {
  conversation_id?: string; sort?: string; limit?: number
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.conversation_id) sp.set('conversation_id', params.conversation_id)
  if (params.sort) sp.set('sort', params.sort)
  if (params.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  const res = await fetch(`/api/llm-logs${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

// ── TourRequest ────────────────────────────────────────────────────────

export async function createTourRequest(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/tour-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── ResearchNotes ─────────────────────────────────────────────────────

export async function fetchResearchNotes(params: { school_id?: string; user_id?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.user_id) sp.set('user_id', params.user_id)
  const qs = sp.toString()
  const res = await fetch(`/api/research-notes${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createResearchNote(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/research-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateResearchNote(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/research-notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function deleteResearchNote(id: string): Promise<void> {
  const res = await fetch(`/api/research-notes/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

// ── Notes ──────────────────────────────────────────────────────────────

export async function fetchNotes(params: { user_id?: string } = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.user_id) sp.set('user_id', params.user_id)
  const qs = sp.toString()
  const res = await fetch(`/api/notes${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

export async function createNote(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function updateNote(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

// ── VisitorLog ─────────────────────────────────────────────────────────

export async function createVisitorLog(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/visitor-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── GeneratedArtifact ──────────────────────────────────────────────────

export async function createArtifact(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

// ── ConversationState ──────────────────────────────────────────────────

export async function fetchConversationState(conversationId: string): Promise<any[]> {
  const res = await fetch(`/api/conversation-state?conversation_id=${encodeURIComponent(conversationId)}`)
  return handleResponse<any[]>(res)
}

// ── ConversationArtifacts ──────────────────────────────────────────────

export async function fetchConversationArtifacts(params: {
  conversation_id?: string; school_id?: string
} = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.conversation_id) sp.set('conversation_id', params.conversation_id)
  if (params.school_id) sp.set('school_id', params.school_id)
  const qs = sp.toString()
  const res = await fetch(`/api/conversation-artifacts${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

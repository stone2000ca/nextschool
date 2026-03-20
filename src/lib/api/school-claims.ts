/**
 * Client-side fetch helpers for SchoolClaim API routes
 * Replaces direct SchoolClaim entity calls in page-components and components
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export interface FetchClaimsParams {
  status?: string
  school_id?: string
  user_id?: string
  claimed_by?: string
}

/** GET /api/school-claims — list/filter claims */
export async function fetchClaims(params: FetchClaimsParams = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.user_id) sp.set('user_id', params.user_id)
  if (params.claimed_by) sp.set('claimed_by', params.claimed_by)
  const qs = sp.toString()
  const res = await fetch(`/api/school-claims${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** POST /api/school-claims — create a new claim */
export async function createClaim(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/school-claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/** PATCH /api/school-claims/[id] — update a claim */
export async function updateClaim(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/school-claims/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

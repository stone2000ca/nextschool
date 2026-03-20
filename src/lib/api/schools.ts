/**
 * Client-side fetch helpers for Schools API routes
 * Replaces direct School entity calls in page-components and components
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export interface FetchSchoolsParams {
  ids?: string[]
  names?: string[]
  slug?: string
  city?: string
  search?: string
  admin_user_id?: string
  sort?: string
  limit?: number
}

/** GET /api/schools — list/filter/search schools */
export async function fetchSchools(params: FetchSchoolsParams = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.ids?.length) sp.set('ids', params.ids.join(','))
  if (params.names?.length) sp.set('names', params.names.join(','))
  if (params.slug) sp.set('slug', params.slug)
  if (params.city) sp.set('city', params.city)
  if (params.search) sp.set('search', params.search)
  if (params.admin_user_id) sp.set('admin_user_id', params.admin_user_id)
  if (params.sort) sp.set('sort', params.sort)
  if (params.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  const res = await fetch(`/api/schools${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** GET /api/schools/[id] — get a single school */
export async function fetchSchool(id: string): Promise<any> {
  const res = await fetch(`/api/schools/${id}`)
  return handleResponse<any>(res)
}

/** POST /api/schools — create a new school */
export async function createSchool(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/** PATCH /api/schools/[id] — update school fields */
export async function updateSchool(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/schools/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/**
 * Client-side fetch helpers for SchoolInquiry API routes
 * Replaces direct SchoolInquiry entity calls in page-components and components
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export interface FetchInquiriesParams {
  school_id?: string
  inquiry_type?: string
}

/** GET /api/school-inquiries — list/filter inquiries */
export async function fetchInquiries(params: FetchInquiriesParams = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.inquiry_type) sp.set('inquiry_type', params.inquiry_type)
  const qs = sp.toString()
  const res = await fetch(`/api/school-inquiries${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** POST /api/school-inquiries — create a new inquiry */
export async function createInquiry(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/school-inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/** PATCH /api/school-inquiries/[id] — update an inquiry */
export async function updateInquiry(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/school-inquiries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

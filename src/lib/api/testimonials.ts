/**
 * Client-side fetch helpers for Testimonial API routes
 * Replaces direct Testimonial entity calls in page-components and components
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export interface FetchTestimonialsParams {
  school_id?: string
  is_visible?: boolean
}

/** GET /api/testimonials — list/filter testimonials */
export async function fetchTestimonials(params: FetchTestimonialsParams = {}): Promise<any[]> {
  const sp = new URLSearchParams()
  if (params.school_id) sp.set('school_id', params.school_id)
  if (params.is_visible !== undefined) sp.set('is_visible', String(params.is_visible))
  const qs = sp.toString()
  const res = await fetch(`/api/testimonials${qs ? `?${qs}` : ''}`)
  return handleResponse<any[]>(res)
}

/** POST /api/testimonials — create a testimonial */
export async function createTestimonial(data: Record<string, any>): Promise<any> {
  const res = await fetch('/api/testimonials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/** PATCH /api/testimonials/[id] — update a testimonial */
export async function updateTestimonial(id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/testimonials/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<any>(res)
}

/** DELETE /api/testimonials/[id] — delete a testimonial */
export async function deleteTestimonial(id: string): Promise<void> {
  const res = await fetch(`/api/testimonials/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

/**
 * buildDeepLink — E51-S1A
 *
 * Generates a /consultant deep link URL with optional query params.
 * Consumed by email templates (S4) and cross-school timeline links (S3).
 *
 * All params are optional — omitting all returns plain "/consultant".
 */

export interface DeepLinkParams {
  /** School slug (e.g. "hudson-college") */
  school?: string;
  /** Detail tab to open: "overview" | "notepad" | "website" */
  tab?: string;
  /** Section within the tab (e.g. "debrief") */
  section?: string;
  /** Specific visit card ID to scroll to / expand */
  visitId?: string;
}

export function buildDeepLink(
  params: DeepLinkParams,
  /** Optional base URL for absolute links (e.g. in emails) */
  baseUrl?: string,
): string {
  const searchParams = new URLSearchParams();

  if (params.school) searchParams.set('school', params.school);
  if (params.tab) searchParams.set('tab', params.tab);
  if (params.section) searchParams.set('section', params.section);
  if (params.visitId) searchParams.set('visitId', params.visitId);

  const query = searchParams.toString();
  const path = query ? `/consultant?${query}` : '/consultant';

  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

/**
 * Function invocation helper (client-side)
 * Maps function names to API routes and invokes them
 */

const ROUTE_MAP: Record<string, string> = {
  orchestrateConversation: 'orchestrate',
  extractEntities: 'extract-entities',
  handleResults: 'handle-results',
  handleDeepDive: 'handle-deep-dive',
  handleBrief: 'handle-brief',
  handleVisitDebrief: 'handle-visit-debrief',
  searchSchools: 'search-schools',
  classifyIntent: 'classify-intent',
  generateComparison: 'generate-comparison',
  generateConversationTitle: 'generate-conversation-title',
  generateMatchExplanations: 'generate-match-explanations',
  generateDecisionNarration: 'generate-decision-narration',
  generateProfileNarrative: 'generate-profile-narrative',
  generateSchoolSummary: 'generate-school-summary',
  generateSharedShortlistLink: 'generate-shared-shortlist-link',
  matchSchoolsForProfile: 'match-schools',
  onboardUser: 'onboard-user',
  summarizeConversation: 'summarize-conversation',
  summarizeConversationMessages: 'summarize-conversation-messages',
  trackSessionEvent: 'track-session-event',
  processTokenTransaction: 'process-token',
  processDebriefCompletion: 'process-debrief-completion',
  handleJourneyOutcome: 'handle-journey-outcome',
  updateUserMemory: 'update-user-memory',
  enrichSchoolFromWeb: 'enrich-school',
  bulkImportSchools: 'bulk-import-schools',
  importEnrichedSchools: 'import-enriched-schools',
  exportSchools: 'export-schools',
  exportShortlist: 'export-shortlist',
  fetchSchoolProfile: 'fetch-school-profile',
  geocodeSchools: 'geocode-schools',
  listSchools: 'list-schools',
  getNearbySchools: 'get-nearby-schools',
  scrapeSchoolPhotos: 'scrape-school-photos',
  updateSchoolPhotos: 'update-school-photos',
  calculateCompletenessScore: 'calculate-completeness-score',
  createCheckoutSession: 'create-checkout-session',
  sendClaimEmail: 'send-claim-email',
  verifyClaimCode: 'verify-claim-code',
  approveClaim: 'approve-claim',
}

export async function invokeFunction<T = any>(name: string, payload: any): Promise<T> {
  const route = ROUTE_MAP[name] || name
  const res = await fetch(`/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${name} failed: ${text}`)
  }
  return res.json()
}

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { fetchSessions, updateSession } from '@/lib/api/sessions';
import { deleteConversation } from '@/lib/api/conversations';
import DeleteConversationConfirm from '@/components/dialogs/DeleteConversationConfirm';
import { fetchVisitsForUser, fetchDeepDiveFlags } from '@/lib/api/visits';
import { deriveJourneyStage } from '@/lib/sessions/deriveJourneyStage';
import Navbar from '@/components/navigation/Navbar';
import SessionRow from '@/components/dashboard/SessionRow';
import EditProfilePanel from '@/components/dashboard/EditProfilePanel';
import UpgradePaywallModal from '@/components/dialogs/UpgradePaywallModal';
import VisitsTimeline from '@/components/visits/VisitsTimeline';
import { Plus, Settings, X, AlertCircle, Crown, CheckCircle, Trash2, MoreVertical, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Helpers ────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(fullName) {
  if (!fullName) return 'there';
  return fullName.split(' ')[0];
}

/** Derive a contextual subheading from the session stages map */
function getSubheading(sessionStages, activeSessions) {
  if (activeSessions.length === 0) return '';
  const hasHighUrgency = activeSessions.some(
    (s) => sessionStages.get(s.id)?.urgency === 'HIGH'
  );
  if (hasHighUrgency) return 'You have items needing attention';
  const allBriefIncomplete = activeSessions.every(
    (s) => sessionStages.get(s.id)?.stage === 'BRIEF_INCOMPLETE'
  );
  if (allBriefIncomplete) return "Let's finish setting up your profiles";
  return "Here's where things stand";
}

/** Default stage for sessions not yet computed */
const DEFAULT_STAGE = {
  stage: 'BRIEF_INCOMPLETE',
  statusLine: 'Loading...',
  ctaLabel: 'Continue',
  ctaRoute: '/consultant',
  urgency: 'NORMAL',
};

// ─── Skeleton Row ───────────────────────────────────────────────────

function SkeletonRow({ opacity }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 w-full rounded-lg bg-[#22222E] animate-pulse"
      style={{ opacity }}
    >
      <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
      <div className="h-6 w-24 bg-white/10 rounded-full flex-shrink-0" />
      <div className="h-8 w-28 bg-white/10 rounded-md flex-shrink-0" />
    </div>
  );
}

// ─── Archived Row (simplified, no CTA) ──────────────────────────────

function ArchivedRow({ session, isPaid, onReactivate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = (session.child_name ?? '?')[0].toUpperCase();

  return (
    <div className="group flex items-center gap-4 px-5 py-4 w-full rounded-lg bg-[#22222E]/60 opacity-50 hover:opacity-70 transition-opacity border-l-2 border-transparent">
      {/* Avatar */}
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white/50 font-semibold text-sm">
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="text-white/70 font-medium truncate block">
          {session.child_name ?? session.profile_name ?? 'Unnamed'}
        </span>
        <p className="text-white/40 text-sm truncate mt-0.5">
          Archived
          {session.child_grade != null && ` · Grade ${session.child_grade}`}
        </p>
      </div>

      {/* Overflow (Reactivate / Delete only) */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-md bg-[#2C2C3A] border border-white/10 shadow-lg z-50 py-1">
            {isPaid ? (
              <button
                onClick={() => { setMenuOpen(false); onReactivate(session); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={14} />
                Reactivate
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-amber-300/70">
                Upgrade to reactivate
              </div>
            )}
            <button
              onClick={() => { setMenuOpen(false); onDelete(session); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user: authUser, isAuthenticated: authIsAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [showArchiveChoiceModal, setShowArchiveChoiceModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reactivateError, setReactivateError] = useState(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [deleteAllTarget, setDeleteAllTarget] = useState(null); // 'active' | 'archived'
  const [shortlistCounts, setShortlistCounts] = useState({}); // { [journey_id]: count }
  const [editingSession, setEditingSession] = useState(null);
  const [sessionStages, setSessionStages] = useState(new Map()); // Map<sessionId, JourneyStageResult>
  const [deleteConfirmSession, setDeleteConfirmSession] = useState(null); // session to delete (single)
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false); // batch delete confirm

  const isPaid = user?.subscription_plan === 'pro' || user?.subscription_plan === 'enterprise';

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === 'active'), [sessions]);
  const archivedSessions = useMemo(() => sessions.filter((s) => s.status === 'archived'), [sessions]);

  useEffect(() => {
    // WC15: Check for upgrade success param
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setShowUpgradeSuccess(true);
      window.history.replaceState({}, document.title, '/dashboard');
    }
  }, []);

  // Wait for auth to finish hydrating before checking authentication.
  // We also depend on authUser because AuthContext sets isAuthenticated=true
  // and isLoadingAuth=false synchronously, but fetches the user profile
  // asynchronously.
  useEffect(() => {
    if (isLoadingAuth) return;
    if (authIsAuthenticated && !authUser) return;
    loadSessions();
  }, [isLoadingAuth, authIsAuthenticated, authUser]);

  const loadSessions = async () => {
    try {
      if (!authIsAuthenticated) {
        navigateToLogin(window.location.pathname);
        return;
      }

      setIsAuthenticated(true);
      const userData = authUser;
      setUser(userData);

      // Fetch ChatSession records for this user
      const chatSessions = await fetchSessions();

      // E48-S3: Diagnostic log when no sessions found
      if (chatSessions.length === 0) {
        console.log('[E48-S3] loadSessions returned 0 rows for user:', userData.id);
      }

      // E48-S3: Filter out deleted sessions, sort by created_at desc
      const sorted = chatSessions
        .filter(s => s.status !== 'deleted')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setSessions(sorted);

      // Fetch shortlist counts from chat_shortlists table
      const journeyIds = sorted.map(s => s.journey_id).filter(Boolean);
      if (journeyIds.length > 0) {
        try {
          const countsRes = await fetch(`/api/shortlist-counts?journey_ids=${encodeURIComponent(journeyIds.join(','))}`);
          if (countsRes.ok) {
            const { counts } = await countsRes.json();
            setShortlistCounts(counts || {});
          }
        } catch (err) {
          console.error('Failed to fetch shortlist counts:', err);
        }
      }

      // E53-S4: Derive journey stages for each session
      const chatHistoryIds = sorted.map((s) => s.chat_history_id).filter(Boolean);
      let visits = [];
      let deepDiveFlags = new Set();
      try {
        const promises = [
          fetchVisitsForUser(userData.id),
        ];
        if (chatHistoryIds.length > 0) {
          promises.push(fetchDeepDiveFlags(chatHistoryIds));
        }
        const results = await Promise.all(promises);
        visits = results[0] || [];
        deepDiveFlags = results[1] || new Set();
      } catch (err) {
        console.error('Failed to fetch visits/deep-dive flags:', err);
      }

      // Group visits by familyJourneyId (= session.journey_id)
      const visitsByJourney = {};
      for (const v of visits) {
        const fjId = v.familyJourneyId;
        if (!fjId) continue;
        if (!visitsByJourney[fjId]) visitsByJourney[fjId] = [];
        visitsByJourney[fjId].push(v);
      }

      const stages = new Map();
      for (const s of sorted) {
        const sVisits = s.journey_id ? (visitsByJourney[s.journey_id] || []) : [];
        const hasDeepDive = s.chat_history_id ? deepDiveFlags.has(s.chat_history_id) : false;
        stages.set(s.id, deriveJourneyStage(s, sVisits, hasDeepDive));
      }
      setSessionStages(stages);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load your sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Session action handlers (all preserved from original) ────────

  const handleNewSearch = () => {
    // WC8: Case 1 (free user with 0 sessions) - navigate directly
    if (activeSessions.length === 0) {
      router.push('/consultant');
      return;
    }

    // WC12: Case 2 (free user with 1+ session) - show upgrade paywall instead
    if (!isPaid) {
      setShowUpgradeModal(true);
      return;
    }

    // WC14: Case 3 (paid user under 5 active sessions) - navigate directly
    if (activeSessions.length < 5) {
      router.push('/consultant');
      return;
    }

    // WC14: Case 4 (paid user at 5 active sessions) - show archive choice modal
    setShowArchiveChoiceModal(true);
  };

  const handleArchiveSessionForNewSearch = async (sessionToArchive) => {
    setModalLoading(true);
    try {
      await updateSession(sessionToArchive.id, { status: 'archived' });
      setShowArchiveChoiceModal(false);
      await loadSessions();
      router.push('/consultant');
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleArchiveSession = async (session) => {
    try {
      await updateSession(session.id, { status: 'archived' });
      await loadSessions();
    } catch (err) {
      console.error('Failed to archive session:', err);
    }
  };

  const handleReactivateSession = async (archivedSession) => {
    if (activeSessions.length >= 5) {
      setReactivateError('You have 5 active profiles. Archive another session first.');
      return;
    }

    try {
      await updateSession(archivedSession.id, { status: 'active' });
      setReactivateError(null);
      await loadSessions();
    } catch (err) {
      console.error('Failed to reactivate session:', err);
      setReactivateError('Failed to reactivate. Please try again.');
    }
  };

  const handleDeleteArchivedSession = (sessionToDelete) => {
    setDeleteConfirmSession(sessionToDelete);
  };

  const executeDeleteSession = async () => {
    const sessionToDelete = deleteConfirmSession;
    if (!sessionToDelete) return;
    setDeleteConfirmSession(null);
    try {
      if (sessionToDelete.chat_history_id) {
        await deleteConversation(sessionToDelete.chat_history_id);
      }
      await updateSession(sessionToDelete.id, {
        status: 'deleted',
        is_active: false,
      });
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleStartOver = async () => {
    if (sessions.length === 0) {
      router.push('/consultant');
      return;
    }

    const activeSession = sessions.find(s => s.status === 'active');
    if (!activeSession) {
      router.push('/consultant');
      return;
    }

    setModalLoading(true);
    try {
      await updateSession(activeSession.id, { status: 'archived' });
      setShowNewSearchModal(false);
      await loadSessions();
      router.push('/consultant');
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditSave = async (sessionId, data) => {
    await updateSession(sessionId, data);
    await loadSessions();
    setEditingSession(null);
  };

  const handleDeleteAll = async () => {
    // This now only handles "archive all active" (deleteAllTarget === 'active')
    // "Delete all archived" goes through the two-step DeleteConversationConfirm dialog
    const toProcess = sessions.filter(s => s.status === deleteAllTarget);
    const isArchivingActive = deleteAllTarget === 'active';
    // Optimistic UI update
    setSessions(prev => isArchivingActive
      ? prev.map(s => s.status === 'active' ? { ...s, status: 'archived' } : s)
      : prev.filter(s => s.status !== 'archived')
    );
    setDeleteAllTarget(null);
    await Promise.all(toProcess.map(async (s) => {
      if (isArchivingActive) {
        return updateSession(s.id, { status: 'archived' });
      } else {
        if (s.chat_history_id) {
          await deleteConversation(s.chat_history_id);
        }
        return updateSession(s.id, { status: 'deleted', is_active: false });
      }
    }));
  };

  const executeDeleteAllArchived = async () => {
    const toProcess = sessions.filter(s => s.status === 'archived');
    setDeleteAllConfirmOpen(false);
    // Optimistic UI update
    setSessions(prev => prev.filter(s => s.status !== 'archived'));
    await Promise.all(toProcess.map(async (s) => {
      if (s.chat_history_id) {
        await deleteConversation(s.chat_history_id);
      }
      return updateSession(s.id, { status: 'deleted', is_active: false });
    }));
  };

  // ─── Loading skeleton ─────────────────────────────────────────────

  if (isLoadingAuth || loading) {
    return (
      <div className="h-screen flex flex-col bg-[#1A1A24] overflow-hidden">
        <Navbar />
        <div className="bg-[#22222E] border-b border-white/10 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="h-7 w-56 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-40 bg-white/10 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 space-y-3">
            <SkeletonRow opacity={0.6} />
            <SkeletonRow opacity={0.8} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1A1A24]">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  const greeting = getGreeting();
  const userFirstName = firstName(user.full_name);
  const subheading = getSubheading(sessionStages, activeSessions);

  return (
    <div className="h-screen flex flex-col bg-[#1A1A24] overflow-hidden">
      <Navbar />

      {/* WC15: Upgrade Success Banner */}
      {showUpgradeSuccess && (
        <div className="bg-gradient-to-r from-teal-600/20 to-emerald-600/20 border-b border-teal-500/50 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white">Welcome to Premium!</h3>
              <p className="text-teal-200 text-sm mt-0.5">You now have access to 5 profiles, sharing, and more.</p>
            </div>
          </div>
          <button
            onClick={() => setShowUpgradeSuccess(false)}
            className="text-white/60 hover:text-white flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Contextual Header */}
      <div className="bg-[#22222E] border-b border-white/10 py-5 flex-shrink-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {greeting}, {userFirstName}
              </h1>
              {/* WC12: Tier badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isPaid
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-500/20 text-slate-300'
              }`}>
                {isPaid && <Crown className="w-3 h-3" />}
                {isPaid ? 'Premium' : 'Free Plan'}
              </div>
            </div>
            {subheading && (
              <p className="text-white/50 text-sm mt-1">{subheading}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleNewSearch}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              New Search
            </Button>
            <button
              onClick={() => router.push('/settings')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {/* E51-S3A: Visits Timeline */}
          {sessions.length > 0 && (
            <div className="mb-6">
              <VisitsTimeline variant="card" />
            </div>
          )}

          {sessions.length === 0 ? (
            /* Empty State */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-sm">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Find the right school
                </h2>
                <p className="text-white/50 mb-8">
                  Start a search to get personalized school recommendations.
                </p>
                <Button
                  onClick={handleNewSearch}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-lg font-semibold gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Start Your First Search
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Active Sessions Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                  Active ({activeSessions.length})
                </h2>
                {activeSessions.length > 0 && (
                  <button
                    onClick={() => setDeleteAllTarget('active')}
                    className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Archive All
                  </button>
                )}
              </div>

              {/* Active SessionRows */}
              <div className="space-y-2 mb-8">
                {activeSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    journeyStage={sessionStages.get(session.id) || DEFAULT_STAGE}
                    isPaid={isPaid}
                    onArchive={() => handleArchiveSession(session)}
                    onEditRequest={(s) => setEditingSession(s)}
                  />
                ))}
              </div>

              {/* Archived — inline expand */}
              {archivedSessions.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowArchived((prev) => !prev)}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors mb-3"
                  >
                    {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    View archived ({archivedSessions.length})
                  </button>

                  {showArchived && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-end mb-1">
                        <button
                          onClick={() => setDeleteAllConfirmOpen(true)}
                          className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete All
                        </button>
                      </div>
                      {archivedSessions.map((session) => (
                        <ArchivedRow
                          key={session.id}
                          session={session}
                          isPaid={isPaid}
                          onReactivate={handleReactivateSession}
                          onDelete={handleDeleteArchivedSession}
                        />
                      ))}
                      {reactivateError && (
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                          {reactivateError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals (all preserved) ─────────────────────────────────── */}

      {/* WC14: Archive Choice Modal (Case 4 - 5 active sessions) */}
      {showArchiveChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#22222E] rounded-lg max-w-md w-full p-6 border border-white/10">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">5 Active Profiles Limit</h2>
                <p className="text-white/70 text-sm">
                  You've reached your limit of 5 active profiles. Archive one to start a new search.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {activeSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleArchiveSessionForNewSearch(session)}
                  disabled={modalLoading}
                  className="w-full p-3 text-left bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="text-white font-medium text-sm">{session.profile_name || 'Untitled'}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {session.child_name && `${session.child_name}`}
                    {session.child_name && session.child_grade != null && ` · Grade ${session.child_grade}`}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowArchiveChoiceModal(false)}
              disabled={modalLoading}
              className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* WC8: New Search Confirmation Modal (Paid Users) */}
      {showNewSearchModal && sessions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#22222E] rounded-lg max-w-md w-full p-6 border border-white/10">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Start a New Search?</h2>
                <p className="text-white/70 text-sm">
                  Starting a new search will replace <strong>{sessions[0].profile_name || 'Untitled Profile'}</strong>, including{' '}
                  <strong>
                    {(() => {
                      try {
                        return sessions[0].matched_schools ? JSON.parse(sessions[0].matched_schools).length : 0;
                      } catch {
                        return 0;
                      }
                    })()}
                  </strong>{' '}
                  matched schools.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleStartOver}
                disabled={modalLoading}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalLoading ? 'Archiving...' : 'Start Over'}
              </button>
              <button
                onClick={() => setShowNewSearchModal(false)}
                disabled={modalLoading}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E22-S1: Delete All Confirmation Modal */}
      {deleteAllTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#22222E] rounded-lg max-w-sm w-full p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">
              {deleteAllTarget === 'archived' ? 'Permanently delete all archived profiles?' : 'Archive all profiles?'}
            </h2>
            <p className="text-white/60 text-sm mb-6">
              {deleteAllTarget === 'archived'
                ? `This will permanently delete all ${archivedSessions.length} archived profiles and all associated conversation history. Cannot be undone. Continue?`
                : `Archive all ${activeSessions.length} active profiles? This cannot be undone.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteAllTarget(null)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {deleteAllTarget === 'archived' ? 'Permanently Delete' : 'Archive All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single session delete — two-step confirmation */}
      <DeleteConversationConfirm
        open={!!deleteConfirmSession}
        onOpenChange={(open) => { if (!open) setDeleteConfirmSession(null); }}
        conversationTitle={deleteConfirmSession?.child_name || deleteConfirmSession?.profile_name || 'Unnamed'}
        childName={deleteConfirmSession?.child_name}
        onConfirmDelete={executeDeleteSession}
      />

      {/* Batch delete all archived — two-step confirmation */}
      <DeleteConversationConfirm
        open={deleteAllConfirmOpen}
        onOpenChange={setDeleteAllConfirmOpen}
        conversationTitle="all archived profiles"
        onConfirmDelete={executeDeleteAllArchived}
        isBatch
        batchCount={archivedSessions.length}
      />

      {/* E53-S3: Edit Profile Side Panel */}
      {editingSession && (
        <EditProfilePanel
          session={editingSession}
          onSave={handleEditSave}
          onClose={() => setEditingSession(null)}
        />
      )}

      {/* WC12: Upgrade Paywall Modal for Free Users */}
      <UpgradePaywallModal
        isOpen={showUpgradeModal}
        variant="NEW_SEARCH"
        onClose={() => setShowUpgradeModal(false)}
        onStartOver={handleStartOver}
        profileData={{
          matchedSchoolsCount: (() => {
            const activeSession = sessions.find(s => s.status === 'active');
            if (!activeSession) return 0;
            try {
              return activeSession.matched_schools ? JSON.parse(activeSession.matched_schools).length : 0;
            } catch {
              return 0;
            }
          })(),
          shortlisted_count: (() => {
            const activeSession = sessions.find(s => s.status === 'active');
            return activeSession?.journey_id ? (shortlistCounts[activeSession.journey_id] ?? 0) : 0;
          })()
        }}
      />
    </div>
  );
}

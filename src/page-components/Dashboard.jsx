import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { ChatSession, ChatHistory } from '@/lib/entities';
import Navbar from '@/components/navigation/Navbar';
import SchoolSearchProfile from '@/components/dashboard/SchoolSearchProfile.jsx';
import UpgradePaywallModal from '@/components/dialogs/UpgradePaywallModal';
import { Plus, Settings, X, AlertCircle, Crown, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const router = useRouter();
  const { user: authUser, isAuthenticated: authIsAuthenticated, navigateToLogin } = useAuth();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [showArchiveChoiceModal, setShowArchiveChoiceModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showArchivedTab, setShowArchivedTab] = useState(false);
  const [reactivateError, setReactivateError] = useState(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [deleteAllTarget, setDeleteAllTarget] = useState(null); // 'active' | 'archived'

  useEffect(() => {
    // WC15: Check for upgrade success param
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setShowUpgradeSuccess(true);
      // Clean up URL param
      window.history.replaceState({}, document.title, '/dashboard');
    }
  }, []);

  useEffect(() => {
    checkAuthAndLoadSessions();
  }, []);

  const checkAuthAndLoadSessions = async () => {
    try {
      const authenticated = authIsAuthenticated;
      setIsAuthenticated(authenticated);

      if (!authenticated) {
        // Redirect to login
        navigateToLogin(window.location.pathname);
        return;
      }

      const userData = authUser;
      setUser(userData);

      // Fetch ChatSession records for this user
      const chatSessions = await ChatSession.filter({
        user_id: userData.id
      });
      
      // Sort by createdAt descending (most recent first)
      const sorted = chatSessions.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setSessions(sorted);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load your sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSearch = () => {
    // WC8: Case 1 (free user with 0 sessions) - navigate directly
    const activeSessions = sessions.filter(s => s.status === 'active');
    if (activeSessions.length === 0) {
      router.push('/consultant');
      return;
    }

    // WC12: Case 2 (free user with 1+ session) - show upgrade paywall instead
    const isPaid = user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise';
    if (!isPaid) {
      // Show upgrade modal for free users
      const activeSession = activeSessions[0];
      const matchedCount = activeSession ? (() => {
        try {
          return activeSession.matched_schools ? JSON.parse(activeSession.matched_schools).length : 0;
        } catch {
          return 0;
        }
      })() : 0;
      
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
      await ChatSession.update(sessionToArchive.id, { status: 'archived' });
      setShowArchiveChoiceModal(false);
      // Refresh sessions
      await checkAuthAndLoadSessions();
      router.push('/consultant');
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleReactivateSession = async (archivedSession) => {
    const activeSessions = sessions.filter(s => s.status === 'active');
    
    // Check if at 5 active sessions
    if (activeSessions.length >= 5) {
      setReactivateError('You have 5 active profiles. Archive another session first.');
      return;
    }

    try {
      await ChatSession.update(archivedSession.id, { status: 'active' });
      setReactivateError(null);
      await checkAuthAndLoadSessions();
    } catch (err) {
      console.error('Failed to reactivate session:', err);
      setReactivateError('Failed to reactivate. Please try again.');
    }
  };

  const handleDeleteArchivedSession = async (sessionToDelete) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'This will permanently delete this search and all conversation history. Cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      // Cascade delete: Remove associated ChatHistory
      if (sessionToDelete.chat_history_id) {
        await ChatHistory.delete(sessionToDelete.chat_history_id);
      }
      // Delete the session
      await ChatSession.update(sessionToDelete.id, { 
        status: 'deleted',
        is_active: false
      });
      await checkAuthAndLoadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleStartOver = async () => {
    if (sessions.length === 0) {
      router.push('/consultant');
      return;
    }

    // Archive the first (most recent) active session
    const activeSession = sessions.find(s => s.status === 'active');
    if (!activeSession) {
      router.push('/consultant');
      return;
    }

    setModalLoading(true);
    try {
      await ChatSession.update(activeSession.id, { status: 'archived' });
      setShowNewSearchModal(false);
      // Refresh sessions
      await checkAuthAndLoadSessions();
      router.push('/consultant');
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSessionArchived = async () => {
    await checkAuthAndLoadSessions();
  };

  const handleDeleteAll = async () => {
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
        // Archive active sessions — soft archive only
        return ChatSession.update(s.id, { status: 'archived' });
      } else {
        // Permanently delete archived sessions + their chat history
        if (s.chat_history_id) {
          await ChatHistory.delete(s.chat_history_id);
        }
        return ChatSession.update(s.id, { status: 'deleted', is_active: false});
      }
    }));
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1E1E2E]">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen flex flex-col bg-[#1E1E2E] overflow-hidden">
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

      {/* Top Bar */}
      <div className="bg-[#2A2A3D] border-b border-white/10 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {user.full_name || 'User'}
            </h1>
            {/* WC12: Tier badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-500/20 text-slate-300'
            }`}>
              {(user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise') && (
                <Crown className="w-3 h-3" />
              )}
              {user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise' ? 'Premium' : 'Free Plan'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleNewSearch}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              New Search
            </Button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          /* No Sessions - Welcome Message */
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🎓</div>
              <h2 className="text-3xl font-bold text-white mb-3">Welcome to NextSchool!</h2>
              <p className="text-white/70 mb-8 text-lg">
                Start your first school search to see your profiles here.
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
          /* Sessions Grid + Shortlist */
          <div>
            {/* Active / Archived Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowArchivedTab(false)}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    !showArchivedTab 
                      ? 'text-white border-teal-500' 
                      : 'text-white/50 border-transparent hover:text-white/70'
                  }`}
                >
                  Active ({sessions.filter(s => s.status === 'active').length})
                </button>
                <button
                  onClick={() => setShowArchivedTab(true)}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    showArchivedTab 
                      ? 'text-white border-teal-500' 
                      : 'text-white/50 border-transparent hover:text-white/70'
                  }`}
                >
                  Archived ({sessions.filter(s => s.status === 'archived').length})
                </button>
              </div>
              {/* Delete All — only shown when current tab has profiles */}
              {!showArchivedTab && sessions.filter(s => s.status === 'active').length > 0 && (
                <button
                  onClick={() => setDeleteAllTarget('active')}
                  className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Archive All
                </button>
              )}
              {showArchivedTab && sessions.filter(s => s.status === 'archived').length > 0 && (
                <button
                  onClick={() => setDeleteAllTarget('archived')}
                  className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All
                </button>
              )}
            </div>

            {/* Active Sessions */}
            {!showArchivedTab && (
              <div>
                <div className="flex flex-wrap gap-4 mb-12">
                  {sessions.filter(s => s.status === 'active').map((session) => (
                    <SchoolSearchProfile
                      key={session.id}
                      session={session}
                      onViewMatches={() => {}}
                      onEditProfile={() => {}}
                      onArchive={handleSessionArchived}
                      isPaid={user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Archived Sessions */}
            {showArchivedTab && (
              <div>
                {sessions.filter(s => s.status === 'archived').length === 0 ? (
                  <div className="bg-[#2A2A3D] rounded-lg p-8 border border-white/10 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="text-white/60">No archived profiles yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.filter(s => s.status === 'archived').map((session) => (
                      <div
                        key={session.id}
                        className="bg-[#2A2A3D]/60 border border-white/10 rounded-lg p-5 flex items-start justify-between opacity-60 hover:opacity-75 transition-opacity"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {session.profile_name || 'Untitled Profile'}
                          </h3>
                          <p className="text-sm text-white/60 mt-1">
                            {session.child_name && `${session.child_name}`}
                            {session.child_name && session.child_grade != null && ` • Grade ${session.child_grade}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise' ? (
                            <>
                              <button
                                onClick={() => handleReactivateSession(session)}
                                className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 text-sm rounded-lg font-medium transition-colors"
                              >
                                Reactivate
                              </button>
                              <button
                                onClick={() => handleDeleteArchivedSession(session)}
                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 text-sm rounded-lg font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <div className="px-3 py-1.5 bg-amber-600/20 text-amber-300 text-xs rounded-lg font-medium">
                              Upgrade to reactivate
                            </div>
                          )}
                        </div>
                      </div>
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

      {/* Modals rendered outside scroll container but inside root div */}

      {/* WC14: Archive Choice Modal (Case 4 - 5 active sessions) */}
      {showArchiveChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2A2A3D] rounded-lg max-w-md w-full p-6 border border-white/10">
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
              {sessions.filter(s => s.status === 'active').map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleArchiveSessionForNewSearch(session)}
                  disabled={modalLoading}
                  className="w-full p-3 text-left bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="text-white font-medium text-sm">{session.profile_name || 'Untitled'}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {session.child_name && `${session.child_name}`}
                    {session.child_name && session.child_grade != null && ` • Grade ${session.child_grade}`}
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
          <div className="bg-[#2A2A3D] rounded-lg max-w-md w-full p-6 border border-white/10">
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
          <div className="bg-[#2A2A3D] rounded-lg max-w-sm w-full p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">
              {deleteAllTarget === 'archived' ? 'Permanently delete all archived profiles?' : 'Archive all profiles?'}
            </h2>
            <p className="text-white/60 text-sm mb-6">
              {deleteAllTarget === 'archived'
                ? `This will permanently delete all ${sessions.filter(s => s.status === deleteAllTarget).length} archived profiles and all associated conversation history. Cannot be undone. Continue?`
                : `Archive all ${sessions.filter(s => s.status === deleteAllTarget).length} active profiles? This cannot be undone.`
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
          shortlisted_count: sessions.find(s => s.status === 'active')?.shortlisted_count || 0
        }}
      />
    </div>
  );
}
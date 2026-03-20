'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, ChevronDown, ChevronRight, ArrowRight,
  MapPin, Clock, CheckCircle2, AlertCircle, LogIn,
} from 'lucide-react';
import { buildDeepLink } from '@/components/utils/buildDeepLink';
import { useAuth } from '@/lib/AuthContext';

const EVENT_TYPE_LABELS = {
  open_house: 'Open House',
  private_tour: 'Private Tour',
  info_night: 'Info Night',
  virtual: 'Virtual',
  other: 'Event',
};

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', bg: 'bg-blue-500/20', text: 'text-blue-300', icon: Clock },
  debrief_pending: { label: 'Debrief Needed', bg: 'bg-amber-500/20', text: 'text-amber-300', icon: AlertCircle },
  completed: { label: 'Completed', bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2 },
};

const IMPRESSION_CONFIG = {
  loved_it: { label: 'Loved it', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  mixed: { label: 'Mixed', bg: 'bg-amber-500/20', text: 'text-amber-300' },
  not_for_us: { label: 'Not for us', bg: 'bg-red-500/20', text: 'text-red-300' },
};

function groupByMonth(records) {
  const groups = {};
  for (const r of records) {
    const date = r.visit_date ? new Date(r.visit_date + 'T00:00:00') : null;
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
      : 'no-date';
    const label = date
      ? date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
      : 'No date set';
    if (!groups[key]) groups[key] = { key, label, records: [] };
    groups[key].records.push(r);
  }
  return Object.values(groups);
}

function formatDay(visitDate) {
  if (!visitDate) return { day: '—', month: '' };
  const d = new Date(visitDate + 'T00:00:00');
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-CA', { month: 'short' }),
  };
}

function VisitRow({ record, onNavigate }) {
  const { day, month } = formatDay(record.visit_date);
  const status = STATUS_CONFIG[record.status] || STATUS_CONFIG.upcoming;
  const StatusIcon = status.icon;
  const impression = record.status === 'completed' && record.impression
    ? IMPRESSION_CONFIG[record.impression]
    : null;

  return (
    <button
      onClick={() => onNavigate(record)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.06] group text-left"
    >
      {/* Date column */}
      <div className="flex-shrink-0 w-10 text-center">
        <div className="text-base font-bold text-white leading-none">{day}</div>
        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{month}</div>
      </div>

      {/* Vertical accent line */}
      <div className="w-px h-9 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">
            {record.school_name || 'Unknown School'}
          </span>
          <span className="text-xs text-slate-400">
            · {EVENT_TYPE_LABELS[record.event_type] || record.event_type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Status pill */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {status.label}
          </span>
          {/* Impression tag — only on completed */}
          {impression && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${impression.bg} ${impression.text}`}>
              {impression.label}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors flex-shrink-0" />
    </button>
  );
}

export default function VisitsTimeline({ variant = 'panel', onClose }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pastExpanded, setPastExpanded] = useState(false);
  // Tracks whether the server rejected us as unauthorized — this is the
  // source of truth for "not logged in" because client-side isAuthenticated
  // can be stale (expired cookies that Supabase hasn't invalidated yet).
  const [serverUnauthorized, setServerUnauthorized] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      setLoading(false);
      setError(null);
      return;
    }
    // Auth state changed to authenticated — clear any prior unauthorized flag
    // (e.g. user just logged in) and fetch fresh data.
    setServerUnauthorized(false);
    setError(null);
    fetchVisits();
  }, [isAuthenticated, isLoadingAuth]);

  async function fetchVisits() {
    try {
      setLoading(true);
      const res = await fetch('/api/visits');
      if (res.status === 401) {
        // Server says we're not authenticated — override client-side auth state.
        // This handles stale cookies where Supabase client thinks we're logged in
        // but the server correctly rejects the expired/invalid session.
        setServerUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to load visits');
      const data = await res.json();
      setVisits(data);
    } catch (err) {
      console.error('[VisitsTimeline] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleNavigate(record) {
    const link = buildDeepLink({
      school: record.school_slug || undefined,
      tab: 'notepad',
      section: 'debrief',
      visitId: record.id,
    });
    router.push(link);
  }

  // Split into upcoming (upcoming + debrief_pending) and past (completed)
  const upcoming = visits.filter(v => v.status === 'upcoming' || v.status === 'debrief_pending');
  const past = visits.filter(v => v.status === 'completed');

  // Group each section by month
  const upcomingGroups = groupByMonth(upcoming);
  const pastGroups = groupByMonth(past);

  // Sort upcoming chronologically, past reverse-chronologically
  upcomingGroups.sort((a, b) => a.key.localeCompare(b.key));
  pastGroups.sort((a, b) => b.key.localeCompare(a.key));

  const isPanel = variant === 'panel';
  const containerClass = isPanel
    ? 'h-full flex flex-col'
    : 'rounded-xl border border-white/10 bg-[#2A2A3D] overflow-hidden';

  return (
    <div className={containerClass} style={isPanel ? { background: '#1E1E30', borderLeft: '1px solid rgba(255,255,255,0.08)' } : undefined}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isPanel ? 'border-l-4 border-l-teal-400' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-400" />
          <h2 className={`${isPanel ? 'text-base' : 'text-lg'} font-bold text-white`}>My Visits</h2>
          {visits.length > 0 && (
            <span className="text-xs text-slate-400 ml-1">({visits.length})</span>
          )}
        </div>
        {isPanel && onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors rounded p-0.5">
            <span className="sr-only">Close</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`${isPanel ? 'flex-1 overflow-y-auto' : ''} p-3`}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-teal-400 border-t-transparent rounded-full" />
          </div>
        ) : (!isAuthenticated || serverUnauthorized) ? (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Sign in to track visits</h3>
            <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
              Log in to plan school visits, track upcoming tours, and record your impressions.
            </p>
            <button
              onClick={() => navigateToLogin()}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400/60" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : visits.length === 0 ? (
          /* Empty state */
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">No visits yet</h3>
            <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
              You haven't planned any visits yet. Browse events from your shortlist to get started.
            </p>
            <button
              onClick={() => router.push('/consultant')}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Consultant
            </button>
          </div>
        ) : (
          <>
            {/* Upcoming section — always expanded */}
            {upcomingGroups.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Upcoming</h3>
                </div>
                {upcomingGroups.map(group => (
                  <div key={group.key} className="mb-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.records.map(r => (
                        <VisitRow key={r.id} record={r} onNavigate={handleNavigate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Divider between sections */}
            {upcomingGroups.length > 0 && pastGroups.length > 0 && (
              <div className="border-t border-white/[0.06] my-3" />
            )}

            {/* Past section — collapsed by default */}
            {pastGroups.length > 0 && (
              <div>
                <button
                  onClick={() => setPastExpanded(!pastExpanded)}
                  className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity"
                >
                  {pastExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                    Completed ({past.length})
                  </h3>
                </button>
                {pastExpanded && pastGroups.map(group => (
                  <div key={group.key} className="mb-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.records.map(r => (
                        <VisitRow key={r.id} record={r} onNavigate={handleNavigate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

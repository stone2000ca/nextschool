import React, { useState, useRef, useEffect } from 'react';
import { computeSectionConfidence, CONFIDENCE_LABELS } from '@/components/utils/computeSectionConfidence';
import VisitJourneySection from '@/components/chat/VisitJourneySection';

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const NsDiamond = ({ width = 20, height = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.54 38.56" width={width} height={height}>
    <path fill="#0d9488" d="M20.21,0h-11.7L0,8.48l7,10.78L0,30.05l8.52,8.52h12.76l19.26-19.3L21.28,0h-1.06ZM37.53,19.27l-16.26,16.29-.09-.09-5.7-5.7,6.06-9.34.75-1.16-.75-1.16-6.06-9.34,5.79-5.76.58.58,15.68,15.68Z"/>
    <polygon fill="white" points="15.48 8.77 21.54 18.11 22.29 19.26 21.54 20.42 15.48 29.76 21.18 35.46 21.28 35.56 37.53 19.27 21.85 3.59 21.27 3.01 15.48 8.77"/>
  </svg>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const shimmerStyle = {
  background: 'linear-gradient(90deg, #f0ead8 25%, #faf5e8 50%, #f0ead8 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: 6,
};

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24, background: '#fffdf5', maxWidth: 660, margin: '0 auto' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ ...shimmerStyle, height: 28, width: '60%', marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ ...shimmerStyle, flex: 1, height: 48, borderRadius: 8 }} />
        ))}
      </div>
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} style={{ ...shimmerStyle, height: 16, width: `${w}%`, marginBottom: 12 }} />
      ))}
      <div style={{ ...shimmerStyle, height: 80, marginTop: 16 }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function KeyDatesContent({ keyDates }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const source = keyDates || [];

  const upcoming = source
    .filter(d => d.date && new Date(d.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (upcoming.length === 0) {
    return <div style={{ fontSize: 12.5, color: '#a89060', fontStyle: 'italic' }}>No upcoming dates on file.</div>;
  }

  return (
    <div style={{ fontSize: 12.5, color: '#5a4030', lineHeight: 1.6 }}>
      {upcoming.map((d, i) => {
        const dateObj = new Date(d.date);
        const daysUntil = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
        const badgeColor = daysUntil < 14 ? '#ef4444' : daysUntil < 30 ? '#d97706' : '#16a34a';
        const badgeText = daysUntil < 14 ? 'Urgent' : daysUntil < 30 ? 'Coming Soon' : null;
        const dateStr = dateObj.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
        const isLast = i === upcoming.length - 1;
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isLast ? 'none' : '1px solid #f5edd4', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{d.label}</span>
              {d.isEstimated && (
                <span style={{ fontSize: 10, color: '#a89060', fontStyle: 'italic', border: '1px solid #d4c9a8', borderRadius: 4, padding: '1px 5px' }}>est.</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {badgeText && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor, borderRadius: 10, padding: '1px 7px' }}>{badgeText}</span>
              )}
              {!badgeText && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: badgeColor, display: 'inline-block' }} />
              )}
              <span style={{ color: '#a89060' }}>{dateStr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const FIT_BADGE = {
  strong_match: { bg: '#22c55e', label: 'Strong Match' },
  good_match: { bg: '#14b8a6', label: 'Good Match' },
  worth_exploring: { bg: '#64748b', label: 'Worth Exploring' },
};

const PRIORITY_TAG_STYLE = {
  high:   { background: '#fee2e2', color: '#b91c1c' },
  medium: { background: '#fef3c7', color: '#b45309' },
  low:    { background: '#dcfce7', color: '#15803d' },
};

function VisitPrepKitContent({ visitPrepKit, schoolData, actionPlan }) {
  if (!visitPrepKit) {
    return (
      <div style={{ fontSize: 12.5, color: '#a89060', fontStyle: 'italic' }}>
        Run a Deep Dive to see visit prep questions.
      </div>
    );
  }

  const { visitQuestions = [], observations = [], redFlags = [], isLocked = false } = visitPrepKit;

  // Derive logistics grid data from schoolData and actionPlan
  const location = schoolData?.location || '';
  const tourEvent = actionPlan?.visitTimeline?.events?.[0];
  const tourDateStr = tourEvent?.date ? new Date(tourEvent.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' }) : null;

  const gridItems = [
    { icon: '📍', title: 'Getting There', text: location || 'Address not available' },
    { icon: '🕐', title: 'Tour Details', text: tourDateStr ? `${tourDateStr}${tourEvent?.title ? ` — ${tourEvent.title}` : ''}` : 'No tour scheduled yet' },
    { icon: '👥', title: "Who You'll Meet", text: 'Admissions team & current parent ambassador' },
    { icon: '💡', title: 'Tips', text: 'Arrive 10 min early\nKids welcome on tour\nBring your questions list' },
  ];

  const documents = [
    'Report cards (last 2 years)',
    'Birth certificate copy',
    'Immunization records',
    'Any IEP/assessment docs',
  ];

  return (
    <div style={{ fontSize: 12.5, color: '#5a4030', lineHeight: 1.7 }}>
      {/* 2×2 Logistics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {gridItems.map((item, i) => (
          <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.icon} {item.title}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{item.text}</div>
          </div>
        ))}
      </div>

      {/* Documents to Bring */}
      <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5b21b6', marginBottom: 4 }}>📄 Documents to Bring</div>
        <ul style={{ listStyle: 'none', fontSize: 11, lineHeight: 1.8, color: '#64748b', padding: 0, margin: 0 }}>
          {documents.map((doc, i) => (
            <li key={i}>☐ {doc}</li>
          ))}
        </ul>
      </div>

      {/* Questions to Ask */}
      {visitQuestions.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 }}>
            Questions to Ask on Tour
          </div>
          <ul style={{ listStyle: 'none', padding: '0 0 0 20px', fontSize: 12, lineHeight: 1.8, margin: 0 }}>
            {visitQuestions.map((q, i) => {
              const tag = (typeof q === 'string') ? 'medium' : (q.priorityTag || 'medium');
              const question = (typeof q === 'string') ? q : q.question;
              const tagColors = { high: { background: '#fecaca', color: '#991b1b' }, medium: { background: '#fef3c7', color: '#92400e' }, low: { background: '#d1fae5', color: '#065f46' } };
              const tagStyle = tagColors[tag] || tagColors.medium;
              const tagLabel = tag.toUpperCase();
              return (
                <li key={i}>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700, marginRight: 6, ...tagStyle }}>{tagLabel}</span>
                  {question}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Things to Notice — premium gated */}
      {(observations?.length > 0 || isLocked) && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Things to Notice
          </div>
          <div style={{ filter: isLocked ? 'blur(4px)' : 'none', userSelect: isLocked ? 'none' : 'auto' }}>
            {(isLocked ? ['Notice how staff interact with students', 'Observe classroom atmosphere and energy', 'Look for signs of student wellbeing'] : observations).map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                <span style={{ color: '#8b5cf6', fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
          {isLocked && <PremiumLockBadge />}
        </div>
      )}

      {/* Red Flags — premium gated */}
      {(redFlags?.length > 0 || isLocked) && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Red Flags to Watch For
          </div>
          <div style={{ filter: isLocked ? 'blur(4px)' : 'none', userSelect: isLocked ? 'none' : 'auto' }}>
            {(isLocked ? ['Watch for misalignment on key priorities', 'Note any concerns around class size'] : redFlags).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                <span style={{ color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>!</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          {isLocked && <PremiumLockBadge />}
        </div>
      )}
    </div>
  );
}

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const THEME_CHIP_STYLE = {
  positive: { background: '#d1fae5', color: '#065f46' },
  neutral:  { background: '#fef3c7', color: '#92400e' },
  negative: { background: '#fecaca', color: '#991b1b' },
};

function CommunityPulseContent({ communityPulse }) {
  if (!communityPulse) {
    return (
      <div style={{ fontSize: 12.5, color: '#a89060', fontStyle: 'italic' }}>
        No community reviews available yet.
      </div>
    );
  }

  const { themes = [], sentimentBreakdown = {}, parentPerspective, reviewCount = 0 } = communityPulse;
  const pos = sentimentBreakdown.positive || 0;
  const neu = sentimentBreakdown.neutral || 0;
  const neg = sentimentBreakdown.negative || 0;

  return (
    <div style={{ fontSize: 12.5, color: '#5a4030', lineHeight: 1.6 }}>
      {/* AI-Distilled Themes */}
      {themes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 8 }}>
            AI-Distilled Themes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {themes.map((t, i) => {
              const chipStyle = THEME_CHIP_STYLE[t.sentiment] || THEME_CHIP_STYLE.neutral;
              return (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 500, ...chipStyle }}>
                  {t.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentiment Bar */}
      {(pos > 0 || neu > 0 || neg > 0) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 6 }}>
            Sentiment
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
            {pos > 0 && <div style={{ width: `${pos}%`, background: '#0d9488' }} />}
            {neu > 0 && <div style={{ width: `${neu}%`, background: '#d4a017' }} />}
            {neg > 0 && <div style={{ width: `${neg}%`, background: '#ef4444' }} />}
          </div>
          <div style={{ display: 'flex', fontSize: 10, gap: 0 }}>
            <div style={{ width: `${pos}%`, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', flexShrink: 0 }} />
              <span style={{ color: '#64748b' }}>{pos}% Positive</span>
            </div>
            <div style={{ width: `${neu}%`, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4a017', flexShrink: 0 }} />
              <span style={{ color: '#64748b' }}>{neu}% Neutral</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ color: '#64748b' }}>{neg}% Negative</span>
            </div>
          </div>
        </div>
      )}

      {/* Parent Perspective */}
      {parentPerspective && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fdf2f8', border: '1px solid #fce7f3', borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: '#831843' }}>
          {parentPerspective}
        </div>
      )}
    </div>
  );
}

const STATUS_DOT = {
  pending:    '#f59e0b',
  new:        '#f59e0b',
  contacted:  '#0d9488',
  scheduled:  '#3b82f6',
  completed:  '#16a34a',
  responded:  '#16a34a',
  closed:     '#94a3b8',
};

function ContactLogContent({ contactLog }) {
  if (!contactLog || contactLog.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: '#a89060', fontStyle: 'italic' }}>
        No inquiries yet. Tour requests and messages to this school will appear here.
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12.5, color: '#5a4030', lineHeight: 1.6 }}>
      {contactLog.map((entry, i) => {
        const dot = STATUS_DOT[entry.status] || '#cbd5e1';
        const isLast = i === contactLog.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid #f5edd4', alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{entry.type}</div>
              <div style={{ color: '#a89060', fontSize: 11 }}>
                {entry.date}{entry.status ? ` — ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}` : ''}
              </div>
              {entry.note && <div style={{ color: '#6b5c40', fontSize: 11, marginTop: 2 }}>{entry.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PremiumLockBadge() {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,253,245,0.6)',
    }}>
      <span style={{
        background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700,
        padding: '3px 12px', borderRadius: 10, letterSpacing: 0.3,
      }}>
        🔒 Premium
      </span>
    </div>
  );
}

function timeAgo(isoString) {
  if (!isoString) return null;
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

const CONFIDENCE_PILL_STYLES = {
  strong:  { background: '#f0fdfa', color: '#0d9488', border: '1px solid #ccfbf1' },
  limited: { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' },
  unknown: { background: '#f8fafc', color: '#94a3b8', border: '1px solid #f1f5f9' },
};

function ConfidencePill({ level }) {
  if (!level) return null;
  const style = CONFIDENCE_PILL_STYLES[level] || CONFIDENCE_PILL_STYLES.unknown;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 10,
      lineHeight: '16px',
      letterSpacing: 0.2,
      ...style,
    }}>
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

// ─── Section Nav ────────────────────────────────────────────────────────────

const SECTION_NAV_ITEMS = [
  { id: 'notes', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, label: 'My Notes', color: '#d4a017' },
  { id: 'findings', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>, label: 'Deep Dive', color: '#0d9488' },
  { id: 'dates', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: 'Dates', color: '#ef4444' },
  { id: 'visitprep', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, label: 'Visit Prep', color: '#8b5cf6', premiumGated: true },
  { id: 'contactlog', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, label: 'Contact Log', color: '#64748b' },
];

const LockSmallIcon = () => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

function SectionNav({ activeSection, isPremium, scrollContainerRef }) {
  const handleClick = (id) => {
    const container = scrollContainerRef?.current;
    const el = container?.querySelector(`[data-section-id="${id}"]`);
    if (el && container) {
      const containerTop = container.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + (elTop - containerTop) - 8, behavior: 'smooth' });
    }
  };

  return (
    <nav style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '8px 0', width: 100, flexShrink: 0,
      position: 'sticky', top: 0, alignSelf: 'flex-start',
      borderRight: '1px solid #e8dfc0',
      background: '#fffdf5',
    }}>
      {SECTION_NAV_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', border: 'none', cursor: 'pointer',
              background: isActive ? `${item.color}12` : 'transparent',
              borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent',
              color: isActive ? item.color : '#a89060',
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              textAlign: 'left', transition: 'all 0.15s',
              lineHeight: 1.2, whiteSpace: 'nowrap',
            }}
          >
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.premiumGated && !isPremium && (
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: '#a89060', marginLeft: 'auto' }}>
                <LockSmallIcon />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResearchNotepad({ loading = false, isPremium = false, schoolData, fitScore, fitLabel, tradeOffs, priorityMatches, aiInsight, chatSummary, journeySteps, keyDates, visitPrepKit, contactLog, researchNotes, onNotesChange, onSaveNotes, lastDeepDiveAt, onRefreshDeepDive, communityPulse, actionPlan, financialSummary, schoolId }) {
  const school = schoolData || null;
  const lastSchoolNameRef = useRef(null);
  if (school?.name && school.name !== 'School') {
    lastSchoolNameRef.current = school.name;
  }
  const displayName = lastSchoolNameRef.current || school?.name || 'Select a school';
  const score = fitScore ?? null;
  const label = fitLabel || null;
  const priorityList = priorityMatches || [];
  const insight = aiInsight || null;
  const journey = journeySteps || [];
  const [localNotes, setLocalNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'editing' | 'saved'
  const saveTimerRef = useRef(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState('findings');
  const scrollContainerRef = useRef(null);

  // E50-S2: Compute confidence levels for each section
  const confidenceData = { priorityMatches: priorityList, tradeOffs, financialSummary, visitPrepKit, keyDates };
  const fitConfidence = computeSectionConfidence('fit', confidenceData);
  const tradeoffsConfidence = computeSectionConfidence('tradeoffs', confidenceData);
  const moneyConfidence = computeSectionConfidence('money', confidenceData);
  const visitPrepConfidence = computeSectionConfidence('visitprep', confidenceData);

  // Track active section on scroll via IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const sectionIds = SECTION_NAV_ITEMS.map(s => s.id);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.dataset.sectionId);
          break;
        }
      }
    }, { root: container, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    sectionIds.forEach(id => {
      const el = container.querySelector(`[data-section-id="${id}"]`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  // Controlled vs uncontrolled: use props if provided, else local state
  const isControlled = onNotesChange != null;
  const noteValue = isControlled ? (researchNotes || '') : localNotes;
  const rawNotesChange = isControlled ? onNotesChange : setLocalNotes;

  const handleNotesChange = (val) => {
    rawNotesChange(val);
    setSaveStatus('editing');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (onSaveNotes) onSaveNotes();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 1200);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  if (loading) return <LoadingSkeleton />;

  const handleSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (onSaveNotes) onSaveNotes();
    setSaved(true);
    setSaveStatus('saved');
    setTimeout(() => { setSaved(false); setSaveStatus('idle'); }, 2000);
  };

  // Fit score circle
  const hasAnalysis = score !== null;
  const fitPct = score ?? 0;
  const fitDeg = Math.round(fitPct * 3.6);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      height: '100%', display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes ns-diamond-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(13,148,136,0)); }
          50% { transform: scale(1.18); filter: drop-shadow(0 0 6px rgba(13,148,136,0.7)); }
        }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Header bar — non-collapsible */}
      <div style={{
        padding: '14px 20px',
        background: 'linear-gradient(180deg, #f5edd4 0%, #fffdf5 100%)',
        borderBottom: '1px solid #e8dfc0',
        position: 'relative', zIndex: 2, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#2d1e0e' }}>
              Deep Dive — {displayName}
            </span>
            <span style={{
              background: '#d4a017', color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '2px 9px', borderRadius: 10, letterSpacing: 0.3,
            }}>
              AI Analysis
            </span>
          </div>
        </div>
        {lastDeepDiveAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: (() => {
                const days = Math.floor((new Date() - new Date(lastDeepDiveAt)) / 86400000);
                if (days >= 60) return '#dc2626';
                if (days >= 30) return '#d97706';
                return '#6b7280';
              })(),
            }}>
              {(() => {
                const days = Math.floor((new Date() - new Date(lastDeepDiveAt)) / 86400000);
                if (days >= 60) return `⚠ Data may be outdated — updated ${timeAgo(lastDeepDiveAt)}`;
                if (days >= 30) return `⚠ Updated ${timeAgo(lastDeepDiveAt)}`;
                return `Updated ${timeAgo(lastDeepDiveAt)}`;
              })()}
            </span>
            {onRefreshDeepDive && Math.floor((new Date() - new Date(lastDeepDiveAt)) / 86400000) >= 30 && !showRefreshConfirm && (
              <button
                onClick={() => setShowRefreshConfirm(true)}
                style={{ fontSize: 11, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Refresh
              </button>
            )}
            {showRefreshConfirm && (
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#6b7280' }}>Re-analyze this school?</span>
                <button
                  onClick={() => { onRefreshDeepDive(); setShowRefreshConfirm(false); }}
                  style={{ fontSize: 11, color: '#fff', background: '#0d9488', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowRefreshConfirm(false)}
                  style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #d4c9a8', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body: Section Nav + Scrollable Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#fffdf5' }}>
        <SectionNav activeSection={activeSection} isPremium={isPremium} scrollContainerRef={scrollContainerRef} />

        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

          {/* Journey Timeline */}
          {journey.length > 0 && (
            <div style={{
              background: 'linear-gradient(180deg, #f5edd4 0%, #fffdf5 100%)',
              padding: '14px 22px 18px',
              borderBottom: '1px solid #e8dfc0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                {journey.map((step, i) => (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                      {step.status === 'completed' ? (
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          background: '#dcfce7', border: '2px solid #16a34a',
                        }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      ) : step.status === 'active' ? (
                        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ animation: 'ns-diamond-pulse 1.8s ease-in-out infinite', display: 'flex' }}>
                            <NsDiamond width={30} height={30} />
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                          background: '#f1f5f9', border: '2px solid #cbd5e1', color: '#94a3b8',
                        }}>
                          {i + 1}
                        </div>
                      )}
                      <span style={{
                        fontSize: 9.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2,
                        color: step.status === 'completed' ? '#16a34a' : step.status === 'active' ? '#0d9488' : '#94a3b8',
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {i < journey.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, marginBottom: 14, maxWidth: 28,
                        background: step.status === 'completed' ? '#86efac' : '#e2e8f0',
                      }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── My Notes ───────────────────────────────────────── */}
          <div data-section-id="notes" style={{
            borderBottom: '1px solid #e8dfc0',
            padding: '20px 22px',
            background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 40%, #fffdf5 100%)',
            borderLeft: '5px solid #d4a017',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2d1e0e', marginBottom: 4 }}>
              Your notes on {displayName}
            </div>
            <div style={{ fontSize: 12, color: '#92824a', marginBottom: 12 }}>
              Your personal workspace — jot down thoughts, questions, and impressions
            </div>
            <textarea
              value={noteValue}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="What stood out to you about this school? Any questions for the tour?"
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                border: '1px solid #d4c9a8', borderRadius: 8, padding: '12px 14px',
                background: '#fffef8', fontSize: 13.5, color: '#3d3020', fontFamily: 'inherit',
                lineHeight: 1.6, outline: 'none', minHeight: 120, maxHeight: 400,
              }}
              onFocus={e => { e.target.style.borderColor = '#d4a017'; e.target.style.boxShadow = '0 0 0 2px rgba(212,160,23,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = '#d4c9a8'; e.target.style.boxShadow = 'none'; }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11.5, color: '#a89060', display: 'flex', alignItems: 'center', gap: 5 }}>
                {saveStatus === 'editing' && (
                  <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a017', display: 'inline-block' }} /> Editing...</>
                )}
                {saveStatus === 'saved' && (
                  <><CheckIcon /> <span style={{ color: '#16a34a' }}>Saved</span></>
                )}
                {saveStatus === 'idle' && noteValue && (
                  <><CheckIcon /> <span style={{ color: '#16a34a' }}>Saved</span></>
                )}
              </span>
              <button
                onClick={handleSave}
                style={{
                  background: '#0d9488', color: '#fff',
                  border: 'none', borderRadius: 7, padding: '8px 20px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save Notes
              </button>
            </div>
          </div>

          {/* ── Deep Dive Findings ─────────────────────────────── */}
          <div data-section-id="findings" style={{ borderLeft: '5px solid #0d9488' }}>
            <div style={{
              padding: '13px 20px', background: 'linear-gradient(135deg, #f0fdfa, #e6fffa, #fff)',
              borderBottom: '1px solid #e8dfc0',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#3d3020' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Deep Dive Findings
              </span>
            </div>

            <div style={{ padding: '18px 20px' }}>

              {/* Fit Score + Chat Bubbles row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'flex-start' }}>

                {/* Conic-gradient fit score circle */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: `conic-gradient(#0d9488 0deg ${fitDeg}deg, #e8dfc0 ${fitDeg}deg 360deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(13,148,136,0.2)',
                    position: 'relative',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', background: '#fffdf5',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: hasAnalysis ? '#0d9488' : '#a89060', lineHeight: 1 }}>{hasAnalysis ? `${fitPct}%` : '—'}</span>
                      <span style={{ fontSize: 7.5, color: '#a89060', fontWeight: 600 }}>FIT</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', letterSpacing: 0.5 }}>
                    {FIT_BADGE[label?.toLowerCase()]?.label || label?.replace(/_/g, ' ') || 'No analysis yet'}
                  </span>
                </div>

                {/* AI Chat Bubbles — derived from tradeOffs */}
                {tradeOffs && tradeOffs.length > 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tradeOffs.slice(0, 3).map((t, i) => {
                      const isWarning = !!t.concern && !t.strength;
                      const text = t.strength || t.concern || `${t.dimension}: ${t.strength || t.concern}`;
                      const bubbleStyle = isWarning
                        ? { background: '#fffbeb', border: '1px solid #fef3c7' }
                        : { background: '#f0fdfa', border: '1px solid #d1fae5' };
                      return (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flexShrink: 0 }}><NsDiamond /></div>
                          <div style={{
                            ...bubbleStyle,
                            borderRadius: '2px 10px 10px 10px',
                            padding: '10px 12px',
                            fontSize: 12.5, lineHeight: 1.6, color: '#1e293b',
                            flex: 1,
                          }}>
                            {t.strength && t.concern ? (
                              <>
                                <span>{t.strength}</span>
                                {t.concern && <span style={{ display: 'block', marginTop: 4, color: '#92400e', fontSize: 12 }}>⚠ {t.concern}</span>}
                              </>
                            ) : text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* How it fits your preferences — two-column layout */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>
                    How it fits your preferences
                  </span>
                  <ConfidencePill level={fitConfidence} />
                </div>
                {priorityList.length > 0 ? (() => {
                  const matches = priorityList.filter(p => p.status === 'match');
                  const flags = priorityList.filter(p => p.status === 'flag' || p.status === 'partial');
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      {/* LEFT: Matches */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#065f46', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f1f5f9' }}>
                          ✓ Matches
                        </div>
                        {matches.length > 0 ? matches.map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 12 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✓</div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.priority}</div>
                              {item.detail && <div style={{ color: '#64748b', fontSize: 11 }}>{item.detail}</div>}
                            </div>
                          </div>
                        )) : (
                          <div style={{ fontSize: 11, color: '#a89060', fontStyle: 'italic' }}>No strong matches identified yet.</div>
                        )}
                      </div>
                      {/* RIGHT: Flags */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#92400e', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f1f5f9' }}>
                          ⚠ Flags
                        </div>
                        {flags.length > 0 ? flags.map((item, i) => {
                          const isFlag = item.status === 'flag';
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 12 }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: isFlag ? '#fecaca' : '#fef3c7', color: isFlag ? '#991b1b' : '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>{isFlag ? '✗' : '!'}</div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.priority}</div>
                                {item.detail && <div style={{ color: '#64748b', fontSize: 11 }}>{item.detail}</div>}
                              </div>
                            </div>
                          );
                        }) : (
                          <div style={{ fontSize: 11, color: '#a89060', fontStyle: 'italic' }}>No flags identified.</div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: 12.5, color: '#a89060', fontStyle: 'italic' }}>
                    Run a Deep Dive to see how this school lines up with your preferences.
                  </div>
                )}
              </div>

              {/* AI Insight box */}
              <div style={{
                marginTop: 16,
                background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
                padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}><NsDiamond /></div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Fit Trade-Off Analysis
                    </span>
                    <ConfidencePill level={tradeoffsConfidence} />
                  </div>
                  <div style={{ fontSize: 12.5, color: insight ? '#134e4a' : '#a89060', lineHeight: 1.55, fontStyle: insight ? 'normal' : 'italic' }}>
                    {insight || 'Run a Deep Dive to see AI insight'}
                  </div>
                </div>
              </div>

              {/* Financial Overview — money confidence */}
              {financialSummary && (
                <div style={{
                  marginTop: 14,
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ flexShrink: 0, fontSize: 16, marginTop: 1 }}>$</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Financial Overview
                      </span>
                      <ConfidencePill level={moneyConfidence} />
                    </div>
                    <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>
                      {financialSummary.tuition > 0
                        ? `Tuition: $${Number(financialSummary.tuition).toLocaleString()}${financialSummary.aid_available ? ' · Financial aid available' : ''}${financialSummary.budget_fit ? ` · ${financialSummary.budget_fit}` : ''}`
                        : 'Tuition information not available'}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Recommendation — chat_summary from deep-dive artifact */}
              {chatSummary && (
                <div style={{
                  marginTop: 14,
                  background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8,
                  padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ flexShrink: 0, fontSize: 16, marginTop: 1 }}>&#9733;</div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                      AI Recommendation
                    </div>
                    <div style={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.55 }}>
                      {chatSummary.length > 300 ? chatSummary.slice(0, 297) + '...' : chatSummary}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Community Pulse ──────────────────────────────── */}
          {communityPulse && (
            <div style={{ borderTop: '1px solid #e8dfc0', borderLeft: '5px solid #ec4899', padding: '13px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#3d3020', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
                <ChatBubbleIcon />
                {`Community Pulse${communityPulse.reviewCount ? ` (${communityPulse.reviewCount} reviews)` : ''}`}
              </div>
              <CommunityPulseContent communityPulse={communityPulse} />
            </div>
          )}

          {/* ── Key Dates ─────────────────────────────────────── */}
          <div data-section-id="dates" style={{ borderTop: '1px solid #e8dfc0', borderLeft: '5px solid #ef4444', padding: '13px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3d3020', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
              <CalendarIcon />
              Key Dates
            </div>
            <KeyDatesContent keyDates={keyDates} />
          </div>

          {/* ── Visit Prep Kit ────────────────────────────────── */}
          <div data-section-id="visitprep" style={{ borderTop: '1px solid #e8dfc0', borderLeft: '5px solid #8b5cf6', padding: '13px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3d3020', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
              <BookIcon />
              Visit Prep Kit
              <ConfidencePill level={visitPrepConfidence} />
            </div>
            <VisitPrepKitContent visitPrepKit={visitPrepKit} schoolData={school} actionPlan={actionPlan} />
          </div>

          {/* ── Visit Journey ──────────────────────────────────── */}
          <div style={{ borderTop: '1px solid #e8dfc0', borderLeft: '5px solid #0d9488' }}>
            <div style={{ padding: '13px 20px 0', background: 'linear-gradient(135deg, #f0fdfa, #e6fffa, #fff)' }}>
              <VisitJourneySection schoolId={schoolId} />
            </div>
          </div>

          {/* ── Contact Log ───────────────────────────────────── */}
          <div data-section-id="contactlog" style={{ borderTop: '1px solid #e8dfc0', borderLeft: '5px solid #64748b', padding: '13px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3d3020', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
              <PhoneIcon />
              Contact Log
            </div>
            <ContactLogContent contactLog={contactLog} />
          </div>


        </div>
      </div>
    </div>
  );
}
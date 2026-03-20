'use client';

import { useState } from 'react';
import { X, ExternalLink, Calendar, MapPin, Video, Clock, Home, Eye, Users, Sunrise, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatEventDate } from '@/components/utils/eventConstants';
import { downloadICS } from '@/utils/generateICS';

// ── Icon per event type ──────────────────────────────────────────────
const EVENT_TYPE_ICONS = {
  open_house: Home,
  campus_tour: MapPin,
  virtual_tour: Video,
  info_session: Users,
  shadow_day: Sunrise,
};

function EventTypeIcon({ type, className = 'h-3.5 w-3.5' }) {
  const Icon = EVENT_TYPE_ICONS[type] || CalendarDays;
  return <Icon className={className} />;
}

// ── Mark as Interested toggle ────────────────────────────────────────
function InterestedToggle({ isInterested, onToggle }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleClick = () => {
    if (isInterested && !confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    setConfirmingRemove(false);
    onToggle(!isInterested);
  };

  const handleCancel = () => setConfirmingRemove(false);

  if (confirmingRemove) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove from Visit Journey?</span>
        <button onClick={handleClick} className="text-xs font-medium text-rose-600 hover:text-rose-700">Yes</button>
        <button onClick={handleCancel} className="text-xs font-medium text-slate-500 hover:text-slate-700">No</button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        isInterested
          ? 'bg-teal-600 text-white'
          : 'bg-white text-teal-700 border border-teal-300 hover:bg-teal-50'
      }`}
    >
      <Eye className="h-3 w-3" />
      {isInterested ? 'Interested' : 'Mark as Interested'}
    </button>
  );
}

// ── Main EventSlideout ───────────────────────────────────────────────
export default function EventSlideout({ event, schoolName, onClose, onInterestToggle }) {
  const [interested, setInterested] = useState(false);

  if (!event) return null;

  const typeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type || 'Event';
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-slate-100 text-slate-700';
  const location = event.location || event.virtual_url || '';
  const isVirtual = !!event.virtual_url && !event.location;

  const handleSaveCalendar = () => {
    downloadICS({
      title: event.title || typeLabel,
      description: event.description || '',
      location: isVirtual ? event.virtual_url : (event.location || ''),
      startDate: event.date,
      endDate: event.end_date || null,
      url: event.registration_url || '',
    });
  };

  const handleInterestToggle = (val) => {
    setInterested(val);
    if (onInterestToggle) {
      onInterestToggle(event.id, val);
    } else {
      // Placeholder: Sprint 2 will write to visit_record
      console.log(`[EventSlideout] Interest toggle: event=${event.id}, interested=${val}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColor} mb-2`}>
              <EventTypeIcon type={event.event_type} className="h-3 w-3" />
              {typeLabel}
            </span>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{event.title || typeLabel}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{schoolName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mt-1 -mr-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {/* Date/Time */}
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{formatEventDate(event.date)}</p>
                {event.end_date && (
                  <p className="text-xs text-slate-500 mt-0.5">Until {formatEventDate(event.end_date)}</p>
                )}
              </div>
            </div>

            {/* Location / Virtual */}
            {(event.location || event.virtual_url) && (
              <div className="flex items-start gap-3">
                {isVirtual ? (
                  <Video className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  {event.location && <p className="text-sm text-slate-700">{event.location}</p>}
                  {event.virtual_url && (
                    <a
                      href={event.virtual_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-1"
                    >
                      Join virtual event <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Capacity */}
            {event.capacity && (
              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">Capacity: {event.capacity}</p>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{event.description}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer CTAs */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-3">
          {/* Primary CTA */}
          {event.registration_url && (
            <Button
              asChild
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              <a href={event.registration_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Register on School Website
              </a>
            </Button>
          )}

          {/* Secondary row */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSaveCalendar}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Save to Calendar
            </button>

            <InterestedToggle isInterested={interested} onToggle={handleInterestToggle} />
          </div>

          {interested && (
            <p className="text-xs text-teal-600 text-center">Added to Visit Journey.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Exported icon helper for reuse in other components ───────────────
export { EventTypeIcon };

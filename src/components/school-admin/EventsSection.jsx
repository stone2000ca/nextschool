import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Lock, Calendar, Plus, Sparkles } from 'lucide-react';

export default function EventsSection({ school }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (school?.id) {
      base44.entities.SchoolEvent.filter({ schoolId: school.id })
        .then(setEvents)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [school?.id]);

  const isPremium = school.subscriptionTier === 'premium';
  const aiEnrichedEvents = events.filter(e => e.source === 'ai_enriched');

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Events & Open Houses</h2>
          <p className="text-sm text-slate-500 mt-1">Manage school events and open house dates.</p>
        </div>
      </div>

      {!isPremium ? (
        <div className="space-y-4">
          {/* Locked Teaser Card */}
          <div className="border-2 border-amber-200 rounded-xl p-6 bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock className="h-6 w-6 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-2">Events Management Unlocked in Premium</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Upgrade to Premium to create, edit, and manage your school's events. Help families discover your open houses, tours, and information sessions.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    Create and edit unlimited events
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    Manage registration and virtual event links
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    Track event attendance and engagement
                  </div>
                </div>
                <Button className="bg-amber-600 hover:bg-amber-700">Upgrade to Premium</Button>
              </div>
            </div>
          </div>

          {/* Social Proof: AI-Enriched Events */}
          {aiEnrichedEvents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI-Generated Examples (Read-Only)</p>
              </div>
              <div className="space-y-3">
                {aiEnrichedEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4 bg-white opacity-75">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{event.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Premium: Events Management */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Your Events</h3>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No events yet.</p>
              <button className="mt-2 text-teal-600 text-sm font-medium hover:underline">
                Create your first event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900">{event.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.location && ` • ${event.location}`}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{event.eventType.replace(/_/g, ' ')}</p>
                    </div>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
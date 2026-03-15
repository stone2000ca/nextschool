import { useEffect } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export function useSEOAndReminders({ sessionId, checkAuth }) {
  useEffect(() => {
    // Set meta tags for SEO
    document.title = 'Meet Your Education Consultant | NextSchool';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'Chat with Jackie or Liam, your AI education consultants. Get personalized private school recommendations in minutes.';

    // Structured data for Service
    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'School Search Consulting',
      description: 'AI-powered personalized private school recommendations',
      provider: {
        '@type': 'Organization',
        name: 'NextSchool',
        url: 'https://nextschool.ca'
      },
      areaServed: ['CA', 'US', 'EU'],
      serviceType: 'Educational Consulting'
    };

    let schemaScript = document.querySelector('script[data-schema="consultant"]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.setAttribute('data-schema', 'consultant');
      document.head.appendChild(schemaScript);
    }
    schemaScript.innerHTML = JSON.stringify(schemaData);

    checkAuth();

    // E16a-019: Check localStorage for upcoming event reminders within 48hrs
    try {
      const stored = localStorage.getItem('ns_event_reminders');
      if (stored) {
        const reminders = JSON.parse(stored);
        const now = new Date();
        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        // Filter for reminders within 48hrs from now
        const upcoming = reminders.filter(reminder => {
          const eventDate = new Date(reminder.eventDate);
          return eventDate > now && eventDate <= fortyEightHoursFromNow;
        });

        // Auto-clean expired reminders (eventDate < now)
        const valid = reminders.filter(r => new Date(r.eventDate) >= now);
        if (valid.length !== reminders.length) {
          localStorage.setItem('ns_event_reminders', JSON.stringify(valid));
        }

        // Show toast for each upcoming reminder
        upcoming.forEach(reminder => {
          const eventDate = new Date(reminder.eventDate);
          const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const timeText = daysUntil === 0 ? 'tomorrow' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
          toast.info(`Reminder: ${reminder.schoolName} — ${reminder.eventTitle} is ${timeText}!`);
        });
      }
    } catch (err) {
      console.error('[E16a-019] Failed to check reminders:', err);
    }

    // Track session start
    base44.functions.invoke('trackSessionEvent', {
      eventType: 'session_start',
      sessionId
    }).catch(err => console.error('Failed to track session:', err));
  }, [sessionId, checkAuth]);
}
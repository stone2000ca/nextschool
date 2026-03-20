/**
 * Generate an ICS calendar file and trigger download.
 * @param {{ title: string, description?: string, location?: string, startDate: string, endDate?: string, url?: string }} event
 */
export function downloadICS({ title, description = '', location = '', startDate, endDate, url = '' }) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dtStart = fmt(startDate);
  const dtEnd = endDate ? fmt(endDate) : fmt(new Date(new Date(startDate).getTime() + 60 * 60 * 1000));
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@nextschool`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NextSchool//Event//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(title)}`,
    description && `DESCRIPTION:${icsEscape(description)}`,
    location && `LOCATION:${icsEscape(location)}`,
    url && `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function icsEscape(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

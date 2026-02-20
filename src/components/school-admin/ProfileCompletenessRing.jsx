import { useState, useEffect } from 'react';

const calculateCompleteness = (school) => {
  if (!school) return 0;

  const weights = {
    coreInfo: { weight: 0.15, fields: ['name', 'address', 'city', 'lowestGrade', 'highestGrade', 'tuition'] },
    contact: { weight: 0.10, fields: ['phone', 'email', 'website'] },
    about: { weight: 0.10, fields: ['missionStatement', 'teachingPhilosophy'] },
    academics: { weight: 0.15, fields: ['avgClassSize', 'studentTeacherRatio', 'languages'] },
    programs: { weight: 0.15, fields: ['artsPrograms', 'sportsPrograms', 'clubs'] },
    admissions: { weight: 0.15, fields: ['applicationDeadline', 'admissionRequirements', 'openHouseDates'] },
    media: { weight: 0.15, fields: ['logoUrl', 'photoGallery'] },
    additional: { weight: 0.05, fields: ['founded', 'enrollment', 'accreditations'] }
  };

  let totalScore = 0;

  for (const [key, { weight, fields }] of Object.entries(weights)) {
    const filledFields = fields.filter(field => {
      const value = school[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim() !== '';
      return value !== null && value !== undefined;
    }).length;

    const sectionScore = (filledFields / fields.length) * weight;
    totalScore += sectionScore;
  }

  return Math.round(totalScore * 100);
};

const getIncompleteItems = (school) => {
  if (!school) return [];

  const items = [];

  // Core Info
  if (!school.name) items.push({ section: 'Basic Info', label: 'School name', id: 'basic' });
  if (!school.address) items.push({ section: 'Basic Info', label: 'Address', id: 'basic' });
  if (!school.city) items.push({ section: 'Basic Info', label: 'City', id: 'basic' });
  if (!school.lowestGrade || school.lowestGrade === undefined) items.push({ section: 'Basic Info', label: 'Grades served', id: 'basic' });

  // Contact
  if (!school.phone) items.push({ section: 'Basic Info', label: 'Phone number', id: 'basic' });
  if (!school.email) items.push({ section: 'Basic Info', label: 'Email address', id: 'basic' });
  if (!school.website) items.push({ section: 'Basic Info', label: 'Website URL', id: 'basic' });

  // About
  if (!school.missionStatement) items.push({ section: 'About', label: 'Mission statement', id: 'about' });
  if (!school.teachingPhilosophy) items.push({ section: 'About', label: 'Teaching philosophy', id: 'about' });
  if (!school.highlights || school.highlights.length < 3) items.push({ section: 'About', label: 'Highlights (3)', id: 'about' });

  // Academics
  if (!school.avgClassSize) items.push({ section: 'Academics', label: 'Average class size', id: 'academics' });
  if (!school.studentTeacherRatio) items.push({ section: 'Academics', label: 'Student-teacher ratio', id: 'academics' });
  if (!school.languages || school.languages.length === 0) items.push({ section: 'Academics', label: 'Languages offered', id: 'academics' });

  // Programs
  if (!school.artsPrograms || school.artsPrograms.length === 0) items.push({ section: 'Programs', label: 'Arts programs', id: 'programs' });
  if (!school.sportsPrograms || school.sportsPrograms.length === 0) items.push({ section: 'Programs', label: 'Sports programs', id: 'programs' });

  // Media
  if (!school.logoUrl) items.push({ section: 'Photos & Media', label: 'School logo', id: 'media' });
  if (!school.photoGallery || school.photoGallery.length < 3) items.push({ section: 'Photos & Media', label: 'Photo gallery (3+)', id: 'media' });

  // Admissions
  if (!school.applicationDeadline) items.push({ section: 'Admissions', label: 'Application deadline', id: 'admissions' });
  if (!school.admissionRequirements || school.admissionRequirements.length === 0) items.push({ section: 'Admissions', label: 'Admission requirements', id: 'admissions' });

  return items;
};

export default function ProfileCompletenessRing({ school }) {
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    setScore(calculateCompleteness(school));
    setItems(getIncompleteItems(school));
  }, [school]);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Circular Progress Ring */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#f0f0f0" strokeWidth="8" />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold text-slate-900">{score}%</div>
          <div className="text-xs text-slate-600">Complete</div>
        </div>
      </div>

      {/* Incomplete Items Checklist */}
      {items.length > 0 && (
        <div className="w-full max-w-md space-y-2">
          <h4 className="font-semibold text-slate-900 mb-3">Complete these items:</h4>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm">
              <div className="h-5 w-5 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-slate-900">{item.label}</div>
                <div className="text-xs text-slate-600">{item.section}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coming Soon Teaser */}
      <div className="w-full max-w-md p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
        <div className="font-semibold text-slate-900 text-sm mb-1">Coming Soon: Profile Analytics</div>
        <div className="text-xs text-slate-600">
          Profile views, search appearances, shortlist additions. Available with Enhanced membership.
        </div>
      </div>
    </div>
  );
}
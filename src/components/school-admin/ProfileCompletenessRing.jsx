import { useState, useEffect } from 'react';

const calculateCompleteness = (school) => {
  if (!school) return 0;

  // TASK C: Fixed weighted scoring (100 points total)
  const scoring = {
    name: 5,
    missionStatement: 15,
    phone: 5,
    email: 5,
    address: 10,
    lowestGrade: 5,
    highestGrade: 5,
    dayTuition: 10,
    genderPolicy: 5,
    curriculumType: 10,
    specializations: 5,
    artsPrograms: 3,
    sportsPrograms: 2,
    logoUrl: 5,
    headerPhotoUrl: 5,
    photoGallery: 5
  };

  let totalScore = 0;

  for (const [field, points] of Object.entries(scoring)) {
    const value = school[field];
    let filled = false;

    if (Array.isArray(value)) {
      filled = value.length > 0;
    } else if (typeof value === 'string') {
      filled = value.trim() !== '';
    } else {
      filled = value !== null && value !== undefined;
    }

    if (filled) {
      totalScore += points;
    }
  }

  return totalScore;
};

const getIncompleteItems = (school) => {
  if (!school) return [];

  const items = [];

  // TASK C: Aligned with weighted scoring
  if (!school.name) items.push({ section: 'Basic Info', label: 'School name (5pts)', id: 'basic', points: 5 });
  if (!school.missionStatement) items.push({ section: 'Culture', label: 'Mission statement (15pts)', id: 'culture', points: 15 });
  if (!school.phone) items.push({ section: 'Basic Info', label: 'Phone number (5pts)', id: 'basic', points: 5 });
  if (!school.email) items.push({ section: 'Basic Info', label: 'Email address (5pts)', id: 'basic', points: 5 });
  if (!school.address) items.push({ section: 'Basic Info', label: 'Address (10pts)', id: 'basic', points: 10 });
  if (school.lowestGrade === null || school.lowestGrade === undefined) items.push({ section: 'Basic Info', label: 'Lowest grade (5pts)', id: 'basic', points: 5 });
  if (school.highestGrade === null || school.highestGrade === undefined) items.push({ section: 'Basic Info', label: 'Highest grade (5pts)', id: 'basic', points: 5 });
  if (!school.dayTuition) items.push({ section: 'Financial', label: 'Day tuition (10pts)', id: 'financial', points: 10 });
  if (!school.genderPolicy) items.push({ section: 'Basic Info', label: 'Gender policy (5pts)', id: 'basic', points: 5 });
  if (!school.curriculumType) items.push({ section: 'Academics', label: 'Curriculum type (10pts)', id: 'academics', points: 10 });
  if (!school.specializations || school.specializations.length === 0) items.push({ section: 'Academics', label: 'Specializations (5pts)', id: 'academics', points: 5 });
  if (!school.artsPrograms || school.artsPrograms.length === 0) items.push({ section: 'Programs', label: 'Arts programs (3pts)', id: 'programs', points: 3 });
  if (!school.sportsPrograms || school.sportsPrograms.length === 0) items.push({ section: 'Programs', label: 'Sports programs (2pts)', id: 'programs', points: 2 });
  if (!school.logoUrl) items.push({ section: 'Photos & Media', label: 'School logo (5pts)', id: 'media', points: 5 });
  if (!school.headerPhotoUrl) items.push({ section: 'Photos & Media', label: 'Header photo (5pts)', id: 'media', points: 5 });
  if (!school.photoGallery || school.photoGallery.length === 0) items.push({ section: 'Photos & Media', label: 'Photo gallery (5pts)', id: 'media', points: 5 });

  return items;
};

export default function ProfileCompletenessRing({ school, onSectionClick }) {
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
            <button
              key={idx}
              onClick={() => onSectionClick && onSectionClick(item.id)}
              className="w-full flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm hover:bg-slate-100 transition-colors text-left focus:ring-2 focus:ring-teal-400 focus:outline-none"
            >
              <div className="h-5 w-5 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-slate-900">{item.label}</div>
                <div className="text-xs text-slate-600">{item.section}</div>
              </div>
            </button>
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
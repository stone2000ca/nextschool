import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, ExternalLink, Scale, CalendarDays, Mail, Phone, Globe2, Eye } from "lucide-react";
import TourRequestModal from './TourRequestModal';
import { SchoolEvent } from '@/lib/entities';

// --- Helpers ---

function gradeLabel(grade) {
  if (grade === null || grade === undefined) return '?';
  if (grade === -2) return 'PK';
  if (grade === -1) return 'JK';
  if (grade === 0) return 'K';
  return String(grade);
}

function f(school, key) {
  return school[key] ?? null;
}

function getCurrencySymbol(currency) {
  const symbols = { CAD: 'CA$', USD: '$', EUR: '€', GBP: '£' };
  return symbols[currency] || '$';
}

function formatTuition(amount, max, currency) {
  const sym = getCurrencySymbol(currency);
  if (!amount) return null;
  if (max && max !== amount) return `${sym}${amount.toLocaleString()} – ${sym}${max.toLocaleString()}`;
  return `${sym}${amount.toLocaleString()}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day away';
  return `${diff} days away`;
}

function parseScholarships(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  try { return JSON.parse(json); } catch { return []; }
}

// --- Match Logic (preserved) ---

function calculateMatchScore(school, familyProfile) {
  if (!familyProfile) return 'Explore';
  let score = 0;
  const childGrade = familyProfile.child_grade;
  if (childGrade !== null && childGrade !== undefined) {
    if (childGrade >= school.lowest_grade && childGrade <= school.highest_grade) score += 2;
  }
  if (familyProfile.max_tuition && school.day_tuition) {
    if (school.day_tuition <= familyProfile.max_tuition) score += 2;
    else if (school.day_tuition <= familyProfile.max_tuition * 1.2) score += 1;
  }
  if (familyProfile.gender && school.gender_policy) {
    const isSingleGender = school.gender_policy.includes(familyProfile.gender === 'male' ? 'Boy' : 'Girl');
    if (isSingleGender && familyProfile.boarding_preference === 'no') score += 1;
    if (school.gender_policy === 'Co-ed' && !isSingleGender) score += 1;
  }
  if (familyProfile.priorities?.length > 0) {
    const specializations = (school.specializations || []).map(s => s.toLowerCase());
    const curriculumStr = (school.curriculum || []).join(' ').toLowerCase();
    const allStr = `${specializations.join(' ')} ${curriculumStr}`.toLowerCase();
    let priorityMatches = 0;
    familyProfile.priorities.forEach(p => {
      if (allStr.includes(p.toLowerCase())) priorityMatches++;
    });
    score += Math.min(priorityMatches * 2, 3);
  }
  if (score >= 8) return 'Strong';
  if (score >= 5) return 'Good';
  return 'Good';
}

function getMatchReasons(school, familyProfile) {
  const reasons = [];
  if (!familyProfile) return reasons;
  const childGrade = familyProfile.child_grade;
  if (childGrade !== null && childGrade !== undefined && childGrade >= school.lowest_grade && childGrade <= school.highest_grade) {
    reasons.push(`Serves Grade ${gradeLabel(childGrade)}`);
  }
  if (familyProfile.max_tuition && school.day_tuition && school.day_tuition <= familyProfile.max_tuition) {
    reasons.push(`Within budget ($${school.day_tuition.toLocaleString()})`);
  }
  if (familyProfile.priorities?.length > 0) {
    const specializations = (school.specializations || []).map(s => s.toLowerCase());
    const curriculumStr = (school.curriculum || []).join(' ').toLowerCase();
    const allStr = `${specializations.join(' ')} ${curriculumStr}`.toLowerCase();
    const matchedPriorities = familyProfile.priorities.filter(p => allStr.includes(p.toLowerCase()));
    if (matchedPriorities.length > 0) {
      reasons.push(`${matchedPriorities.slice(0, 2).join(' & ')} focus`);
    }
  }
  if (familyProfile.boarding_preference?.includes('boarding') && school.boarding_available) {
    reasons.push('Boarding available');
  }
  return reasons.slice(0, 4);
}

// --- Section Components ---

function HeroSection({ school, onBack }) {
  const boardingType = f(school, 'boarding_type') || (school.boarding_available ? 'Day & Boarding' : 'Day');
  const faithBased = f(school, 'faith_based');
  const logoUrl = f(school, 'logo_url');
  const gradeRange = school.lowest_grade != null && school.highest_grade != null
    ? `${gradeLabel(school.lowest_grade)} – ${gradeLabel(school.highest_grade)}`
    : school.grades_served || null;

  return (
    <div className="relative h-[420px] overflow-hidden">
      {(school.header_photo_url || school.hero_image) ? (
        <img
          src={school.header_photo_url || school.hero_image}
          alt={school.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#1a2332] to-[#0f1419]" />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,20,25,0.15) 0%, rgba(15,20,25,0.85) 100%)' }} />

      {/* Back + Logo */}
      <div className="absolute top-5 left-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-white/20 transition-colors"
        >
          &larr; Back to Results
        </button>
        {logoUrl && (
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white/90 p-1 object-contain" />
        )}
      </div>

      {/* Hero Content */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-8">
        <div className="flex flex-wrap gap-2.5 mb-4">
          {boardingType && (
            <span className="bg-white/12 backdrop-blur-sm border border-white/18 text-white text-[12px] font-semibold px-3.5 py-1 rounded-md uppercase tracking-wider">
              {boardingType}
            </span>
          )}
          {school.gender_policy && (
            <span className="bg-white/12 backdrop-blur-sm border border-white/18 text-white text-[12px] font-semibold px-3.5 py-1 rounded-md uppercase tracking-wider">
              {school.gender_policy}
            </span>
          )}
          {gradeRange && (
            <span className="bg-white/12 backdrop-blur-sm border border-white/18 text-white text-[12px] font-semibold px-3.5 py-1 rounded-md uppercase tracking-wider">
              {gradeRange}
            </span>
          )}
          {faithBased && (
            <span className="bg-white/12 backdrop-blur-sm border border-white/18 text-white text-[12px] font-semibold px-3.5 py-1 rounded-md uppercase tracking-wider">
              {faithBased}
            </span>
          )}
        </div>
        <h1 className="text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          {school.name}
        </h1>
        <p className="text-[15px] text-white/70">
          {school.city}, {school.province_state}
          {school.founded ? ` · Est. ${school.founded}` : ''}
        </p>
      </div>
    </div>
  );
}

function ScanBar({ school }) {
  const pills = [];
  const add = (emoji, text, highlight) => pills.push({ emoji, text, highlight });

  if (school.enrollment) add('\u{1F465}', `${school.enrollment.toLocaleString()} students`);
  if (school.avg_class_size) add('\u{1F465}', `Avg class ${school.avg_class_size}`);
  const ratio = f(school, 'student_teacher_ratio');
  if (ratio) add('\u{1F393}', `${ratio} ratio`);
  const curriculum = school.curriculum;
  if (curriculum) add('\u{1F4DA}', Array.isArray(curriculum) ? curriculum.join(' · ') : curriculum);
  if (school.financial_aid_available) add('\u{1F4B0}', 'Aid available', true);
  if (school.founded) add('\u{1F3DB}', `Est. ${school.founded}`);
  const accreditations = school.accreditations;
  if (accreditations?.length > 0) add('\u2705', `${accreditations[0]} accredited`);
  if (school.acceptance_rate) add('\u{1F393}', `${school.acceptance_rate}% acceptance`);
  if (school.campus_size) add('\u{1F3E1}', `${school.campus_size}-acre campus`);
  if (school.uniform_required) add('\u{1F454}', 'Uniform');
  const langs = f(school, 'languages_of_instruction');
  if (langs) add('\u{1F310}', Array.isArray(langs) ? langs.join(' · ') : langs);
  const intlPct = f(school, 'international_student_pct');
  if (intlPct) add('\u{1F30D}', `${intlPct}% international`);
  const boardingPct = f(school, 'boarding_pct');
  if (boardingPct) add('\u{1F3E0}', `${boardingPct}% boarders`);
  const transport = f(school, 'transportation_options');
  if (transport) add('\u{1F68C}', Array.isArray(transport) ? transport.join(', ') : transport);
  const awards = school.awards;
  if (awards?.length > 0) add('\u{1F3C6}', 'Award-winning');

  if (pills.length === 0) return null;

  return (
    <div className="flex gap-2.5 px-8 py-6 overflow-x-auto border-b border-white/[0.06]" style={{ scrollbarWidth: 'none' }}>
      {pills.map((pill, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap border transition-colors
            ${pill.highlight
              ? 'bg-green-600/10 border-green-600/25 text-green-300'
              : 'bg-white/[0.04] border-white/[0.08] text-[#b8b5af] hover:border-white/20'
            }`}
        >
          <span className="text-sm">{pill.emoji}</span>
          {pill.text}
        </div>
      ))}
    </div>
  );
}

function AboutSection({ school }) {
  const [expanded, setExpanded] = useState(false);
  const values = school.values;
  const specializations = school.specializations;
  const desc = school.description || '';
  const isLong = desc.length > 300;

  const hasMission = !!school.mission_statement;
  const hasContent = hasMission || !!desc;
  if (!hasContent && !values?.length && !specializations?.length) return null;

  return (
    <div className="px-8 pt-10">
      {hasMission && (
        <blockquote className="border-l-[3px] border-[#c9a84c] pl-6 pr-4 py-5 mb-5 rounded-r-lg italic text-[17px] text-[#d4cfc5] leading-relaxed" style={{ fontFamily: "'Playfair Display', serif", background: 'rgba(201,168,76,0.04)' }}>
          &ldquo;{school.mission_statement}&rdquo;
        </blockquote>
      )}
      {values?.length > 0 && (
        <p className="text-[13px] text-[#9a9590] italic mb-4">
          {Array.isArray(values) ? values.join(' · ') : values}
        </p>
      )}
      {desc && (
        <p className="text-[15px] text-[#9a9590] leading-relaxed max-w-[720px]">
          {isLong && !expanded ? desc.slice(0, 300) + '...' : desc}
        </p>
      )}
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-[#c9a84c] font-semibold text-[13px] mt-3 bg-transparent border-none cursor-pointer tracking-wide">
          {expanded ? 'Show less \u2191' : 'Read more \u2193'}
        </button>
      )}
      {specializations?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {specializations.map((s, i) => (
            <span key={i} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-[#b8b5af] font-medium hover:border-white/[0.18] hover:text-[#e8e6e1] transition-colors">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-white/[0.06] mx-8 mt-10" />;
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-[26px] font-bold text-[#f5f3ef] mb-6 tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
      {children}
    </h2>
  );
}

function WhatToExpectSection({ school }) {
  const items = [];
  const add = (label, value) => { if (value) items.push({ label, value }); };

  add('Academic Culture', f(school, 'academic_culture'));
  add('Pace', f(school, 'curriculum_pace'));
  add('Focus', f(school, 'school_focus'));
  add('Math Approach', f(school, 'math_approach'));
  add('Science', f(school, 'science_approach'));
  add('Homework', f(school, 'homework_by_grade'));
  add('Philosophy', f(school, 'teaching_philosophy'));

  const communityVibe = f(school, 'community_vibe');
  if (items.length === 0 && !communityVibe) return null;

  return (
    <div className="px-8 pt-10">
      <SectionTitle>What to Expect</SectionTitle>
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3.5">
          {items.map((item, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-4 flex flex-col gap-1 hover:border-white/[0.12] transition-colors">
              <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">{item.label}</span>
              <span className="text-[15px] font-semibold text-[#e8e6e1]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {communityVibe && (
        <div className="mt-5 rounded-xl p-6 border border-[#c9a84c]/15" style={{ background: 'rgba(201,168,76,0.06)' }}>
          <h3 className="text-[16px] font-bold text-[#c9a84c] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Community Vibe</h3>
          <p className="text-[14px] text-[#9a9590] leading-relaxed">{communityVibe}</p>
        </div>
      )}
    </div>
  );
}

function ProgramsSection({ school }) {
  const groups = [];
  if (school.arts_programs?.length > 0) groups.push({ label: 'Arts', items: school.arts_programs });
  if (school.sports_programs?.length > 0) groups.push({ label: 'Sports', items: school.sports_programs });
  if (school.clubs?.length > 0) groups.push({ label: 'Clubs', items: school.clubs });

  const specialEd = f(school, 'special_ed_programs');
  if (specialEd?.length > 0) groups.push({ label: 'Learning Support', items: specialEd });
  const facilities = school.facilities;
  if (facilities?.length > 0) groups.push({ label: 'Facilities', items: facilities });

  if (groups.length === 0) return null;

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Programs</SectionTitle>
      {groups.map((group, gi) => (
        <div key={gi} className="mb-6">
          <h3 className="text-[13px] font-semibold text-[#7a756e] mb-2.5 uppercase tracking-[0.8px]">{group.label}</h3>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item, i) => (
              <span key={i} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-[#b8b5af] font-medium hover:border-white/[0.18] hover:text-[#e8e6e1] transition-colors">
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FinancialSection({ school }) {
  const currency = school.currency || 'CAD';
  const dayTuition = school.day_tuition;
  const dayMax = f(school, 'day_tuition_max');
  const boardingTuition = school.boarding_tuition;
  const boardingMax = f(school, 'boarding_tuition_max');
  const aidAvailable = school.financial_aid_available;
  const aidPct = f(school, 'financial_aid_pct');
  const medianAid = f(school, 'median_aid_amount');
  const tuitionNotes = f(school, 'tuition_notes');
  const scholarships = parseScholarships(f(school, 'scholarships_json'));

  const hasData = dayTuition || boardingTuition || aidAvailable || aidPct || medianAid;
  if (!hasData) return null;

  const sym = getCurrencySymbol(currency);

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Financial Picture</SectionTitle>
      <div className="grid grid-cols-2 gap-3.5">
        {dayTuition && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">Day Tuition</span>
            <span className="text-[24px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>
              {formatTuition(dayTuition, dayMax, currency)}<span className="text-[14px] font-normal text-[#6b6560]">/yr</span>
            </span>
            {currency !== 'CAD' && <span className="text-[11px] text-[#7a756e] font-medium">{currency}</span>}
          </div>
        )}
        {boardingTuition && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">Boarding Tuition</span>
            <span className="text-[24px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>
              {formatTuition(boardingTuition, boardingMax, currency)}<span className="text-[14px] font-normal text-[#6b6560]">/yr</span>
            </span>
          </div>
        )}
        {aidAvailable != null && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">Financial Aid</span>
            <span className={`text-[24px] font-bold ${aidAvailable ? 'text-green-300' : 'text-[#f5f3ef]'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
              {aidAvailable ? 'Available' : 'Not Available'}
            </span>
          </div>
        )}
        {aidPct && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">Students on Aid</span>
            <span className="text-[24px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>{aidPct}%</span>
          </div>
        )}
        {medianAid && (
          <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px]">Median Package</span>
            <span className="text-[24px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>{sym}{medianAid.toLocaleString()}</span>
          </div>
        )}
      </div>
      {scholarships.length > 0 && (
        <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-5 py-5">
          <span className="text-[11px] text-[#6b6560] font-medium uppercase tracking-[0.8px] block mb-3">Scholarships</span>
          <div className="space-y-2">
            {scholarships.map((s, i) => (
              <div key={i} className="text-[13px] text-[#b8b5af]">
                <span className="font-semibold text-[#e8e6e1]">{s.name || s.title || `Scholarship ${i + 1}`}</span>
                {(s.amount || s.value) && <span className="ml-2 text-green-300">{sym}{(s.amount || s.value).toLocaleString()}</span>}
                {s.eligibility && <span className="ml-2 text-[#6b6560]">— {s.eligibility}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {tuitionNotes && (
        <p className="text-[12px] text-[#6b6560] italic mt-4">{tuitionNotes}</p>
      )}
    </div>
  );
}

function AdmissionsSection({ school }) {
  const dayDeadline = school.day_admission_deadline;
  const boardingDeadline = f(school, 'boarding_admission_deadline');
  const openHouse = school.open_house_dates?.[0];
  const openHouseCountdown = daysUntil(openHouse);
  const requirements = school.admission_requirements || f(school, 'entrance_requirements') || [];
  const applicationProcess = f(school, 'application_process');
  const livingArrangements = f(school, 'living_arrangements');

  const hasData = dayDeadline || boardingDeadline || openHouse || requirements.length > 0;
  if (!hasData) return null;

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Admissions</SectionTitle>
      <div className="grid grid-cols-2 gap-3.5">
        {dayDeadline && (
          <div className="rounded-xl p-5 flex flex-col gap-1.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <span className="text-[11px] text-[#7a756e] font-medium uppercase tracking-[0.8px]">Application Deadline</span>
            <span className="text-[20px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>{dayDeadline}</span>
          </div>
        )}
        {boardingDeadline && (
          <div className="rounded-xl p-5 flex flex-col gap-1.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <span className="text-[11px] text-[#7a756e] font-medium uppercase tracking-[0.8px]">Boarding Deadline</span>
            <span className="text-[20px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>{boardingDeadline}</span>
          </div>
        )}
        {openHouse && (
          <div className={`rounded-xl p-5 flex flex-col gap-1.5 ${!dayDeadline && !boardingDeadline ? 'col-span-2' : ''}`} style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <span className="text-[11px] text-[#7a756e] font-medium uppercase tracking-[0.8px]">Next Open House</span>
            <span className="text-[20px] font-bold text-[#f5f3ef]" style={{ fontFamily: "'Playfair Display', serif" }}>{openHouse}</span>
            {openHouseCountdown && (
              <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md w-fit" style={{ background: 'rgba(22,163,74,0.12)', color: '#86efac' }}>
                {openHouseCountdown}
              </span>
            )}
          </div>
        )}
      </div>

      {livingArrangements?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {(Array.isArray(livingArrangements) ? livingArrangements : [livingArrangements]).map((a, i) => (
            <span key={i} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-[#b8b5af] font-medium">
              {a}
            </span>
          ))}
        </div>
      )}

      {requirements.length > 0 && (
        <>
          <h3 className="text-[14px] font-semibold text-[#9a9590] mt-6 mb-3">Requirements</h3>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(requirements) ? requirements : [requirements]).map((req, i) => (
              <span key={i} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-[#b8b5af] font-medium">
                {req}
              </span>
            ))}
          </div>
        </>
      )}

      {applicationProcess && (
        <>
          <h3 className="text-[14px] font-semibold text-[#9a9590] mt-6 mb-3">Application Process</h3>
          {Array.isArray(applicationProcess) ? (
            <ol className="space-y-2 ml-1">
              {applicationProcess.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px] text-[#b8b5af]">
                  <span className="text-[#c9a84c] font-bold min-w-[18px]">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-[#9a9590]">{applicationProcess}</p>
          )}
        </>
      )}
    </div>
  );
}

function OutcomesSection({ school }) {
  const placements = f(school, 'university_placements');
  if (!placements || (Array.isArray(placements) && placements.length === 0)) return null;

  const items = Array.isArray(placements) ? placements : [placements];

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Outcomes & Alumni</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {items.map((p, i) => (
          <span key={i} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-[#b8b5af] font-medium">
            {typeof p === 'string' ? p : p.name || p.university || JSON.stringify(p)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CampusMediaSection({ school }) {
  const gallery = f(school, 'photo_gallery');
  const virtualTour = f(school, 'virtual_tour_url');
  if (!gallery?.length && !virtualTour) return null;

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Campus & Media</SectionTitle>
      {gallery?.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {gallery.slice(0, 6).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${school.name} photo ${i + 1}`}
              className="h-36 w-52 object-cover rounded-lg shrink-0"
              loading="lazy"
            />
          ))}
        </div>
      )}
      {virtualTour && (
        <a href={virtualTour} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-[#c9a84c] font-semibold text-[13px] hover:underline">
          <Eye className="h-4 w-4" />
          Take a Virtual Tour &rarr;
        </a>
      )}
    </div>
  );
}

function ContactSection({ school }) {
  const { website, email, phone } = school;
  if (!website && !email && !phone) return null;

  return (
    <div className="px-8 pt-10">
      <SectionTitle>Contact</SectionTitle>
      <div className="space-y-3">
        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-[14px] text-[#c9a84c] font-medium hover:underline"
          >
            <Globe2 className="h-4 w-4" />
            Visit School Website &rarr;
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-2.5 text-[14px] text-[#b8b5af] hover:text-[#e8e6e1]">
            <Mail className="h-4 w-4 text-[#6b6560]" />
            {email}
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-2.5 text-[14px] text-[#b8b5af] hover:text-[#e8e6e1]">
            <Phone className="h-4 w-4 text-[#6b6560]" />
            {phone}
          </a>
        )}
      </div>
    </div>
  );
}

function CtaBar({ school, isShortlisted, onToggleShortlist, onCompare, hasTourFeatures, onRequestTour }) {
  const nextOpenHouse = school.open_house_dates?.[0];
  const countdown = daysUntil(nextOpenHouse);

  return (
    <div className="sticky bottom-0 left-0 right-0 border-t border-white/[0.06] px-6 py-4 flex gap-3 items-center z-40" style={{ background: 'rgba(20,26,31,0.95)', backdropFilter: 'blur(12px)' }}>
      {/* Primary CTA */}
      {nextOpenHouse && countdown ? (
        <button className="flex-1 rounded-[10px] py-3.5 text-[14px] font-bold cursor-pointer border-none transition-colors" style={{ background: '#c9a84c', color: '#141a1f', fontFamily: "'Inter', sans-serif" }}>
          RSVP — Open House {nextOpenHouse}
        </button>
      ) : hasTourFeatures ? (
        <button onClick={onRequestTour} className="flex-1 rounded-[10px] py-3.5 text-[14px] font-bold cursor-pointer border-none transition-colors" style={{ background: '#c9a84c', color: '#141a1f', fontFamily: "'Inter', sans-serif" }}>
          Request a Tour
        </button>
      ) : (
        school.website && (
          <a href={school.website.startsWith('http') ? school.website : `https://${school.website}`} target="_blank" rel="noopener noreferrer" className="flex-1">
            <button className="w-full rounded-[10px] py-3 text-[13px] font-semibold cursor-pointer bg-transparent border-[1.5px] transition-colors" style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: "'Inter', sans-serif" }}>
              Visit Website
            </button>
          </a>
        )
      )}
      {/* Secondary */}
      {hasTourFeatures && nextOpenHouse && (
        <button onClick={onRequestTour} className="rounded-[10px] px-5 py-3 text-[13px] font-semibold cursor-pointer bg-transparent border-[1.5px] whitespace-nowrap transition-colors" style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: "'Inter', sans-serif" }}>
          Request a Tour
        </button>
      )}
      {/* Icon buttons */}
      <button
        onClick={() => onToggleShortlist(school.id)}
        className="w-11 h-11 rounded-[10px] border border-white/10 flex items-center justify-center cursor-pointer bg-transparent shrink-0 text-[#7a756e] hover:border-white/25 hover:text-[#e8e6e1] transition-colors"
      >
        <Heart className={`h-[18px] w-[18px] ${isShortlisted ? 'fill-red-400 text-red-400' : ''}`} />
      </button>
      <button
        onClick={() => onCompare?.(school.id)}
        className="w-11 h-11 rounded-[10px] border border-white/10 flex items-center justify-center cursor-pointer bg-transparent shrink-0 text-[#7a756e] hover:border-white/25 hover:text-[#e8e6e1] transition-colors"
      >
        <Scale className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

// --- Main Component ---

export default function SchoolDetailPanel({
  school,
  familyProfile,
  onBack,
  onToggleShortlist,
  onCompare,
  isShortlisted,
  actionPlan,
  visitPrepKit,
  isPremium,
  onUpgrade,
}) {
  const [showTourModal, setShowTourModal] = useState(false);
  const [schoolEvents, setSchoolEvents] = useState([]);

  useEffect(() => {
    if (!school || !school.id) {
      setSchoolEvents([]);
      return;
    }
    let isMounted = true;
    SchoolEvent.filter({ school_id: school.id })
      .then((data) => {
        if (!isMounted) return;
        setSchoolEvents(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setSchoolEvents([]);
      });
    return () => { isMounted = false; };
  }, [school?.id]);

  if (!school) return null;

  const hasTourFeatures = school.school_tier === 'growth' || school.school_tier === 'pro';

  return (
    <div className="h-full flex flex-col text-[#e8e6e1]" style={{ background: '#141a1f', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <HeroSection school={school} onBack={onBack} />
        <ScanBar school={school} />
        <AboutSection school={school} />
        <Divider />
        <WhatToExpectSection school={school} />
        <Divider />
        <ProgramsSection school={school} />
        <Divider />
        <FinancialSection school={school} />
        <Divider />
        <AdmissionsSection school={school} />
        <Divider />
        <OutcomesSection school={school} />
        <CampusMediaSection school={school} />
        <ContactSection school={school} />
        {/* Bottom padding for CTA bar */}
        <div className="h-10" />
      </div>

      {/* Sticky CTA */}
      <CtaBar
        school={school}
        isShortlisted={isShortlisted}
        onToggleShortlist={onToggleShortlist}
        onCompare={onCompare}
        hasTourFeatures={hasTourFeatures}
        onRequestTour={() => setShowTourModal(true)}
      />

      {showTourModal && (
        <TourRequestModal
          school={school}
          onClose={() => setShowTourModal(false)}
          upcomingEvents={schoolEvents}
        />
      )}
    </div>
  );
}

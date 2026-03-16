import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, ExternalLink, CheckCircle, Check, X, CalendarDays, Mail } from "lucide-react";
import TourRequestModal from './TourRequestModal';
import { base44 } from '@/api/base44Client';

function gradeLabel(grade) {
  if (grade === null || grade === undefined) return '?';
  if (grade === -2) return 'PK';
  if (grade === -1) return 'JK';
  if (grade === 0) return 'K';
  return String(grade);
}

function calculateMatchScore(school, familyProfile) {
  if (!familyProfile) return 'Explore';
  
  let score = 0;
  const maxScore = 10;
  
  // Grade match
  const childGrade = familyProfile.childGrade;
  if (childGrade !== null && childGrade !== undefined) {
    const schoolServes = childGrade >= school.lowest_grade && childGrade <= school.highest_grade;
    if (schoolServes) score += 2;
  }
  
  // Budget match
  if (familyProfile.maxTuition && school.day_tuition) {
    if (school.day_tuition <= familyProfile.maxTuition) score += 2;
    else if (school.day_tuition <= familyProfile.maxTuition * 1.2) score += 1;
  }
  
  // Gender match
  if (familyProfile.gender && school.gender_policy) {
    const isSingleGender = school.gender_policy.includes(familyProfile.gender === 'male' ? 'Boy' : 'Girl');
    if (isSingleGender && familyProfile.boardingPreference === 'no') score += 1;
    if (school.gender_policy === 'Co-ed' && !isSingleGender) score += 1;
  }
  
  // Priority matches
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
  return 'Good'; // default to Good Match so badge always shows positively
}

function getMatchReasons(school, familyProfile) {
  const reasons = [];
  if (!familyProfile) return reasons;
  
  // Grade
  const childGrade = familyProfile.childGrade;
  if (childGrade !== null && childGrade !== undefined && childGrade >= school.lowest_grade && childGrade <= school.highest_grade) {
    reasons.push(`Serves Grade ${gradeLabel(childGrade)}`);
  }
  
  // Budget
  if (familyProfile.maxTuition && school.day_tuition && school.day_tuition <= familyProfile.maxTuition) {
    reasons.push(`Within budget ($${school.day_tuition.toLocaleString()})`);
  }
  
  // Specializations matching priorities
  if (familyProfile.priorities?.length > 0) {
    const specializations = (school.specializations || []).map(s => s.toLowerCase());
    const curriculumStr = (school.curriculum || []).join(' ').toLowerCase();
    const allStr = `${specializations.join(' ')} ${curriculumStr}`.toLowerCase();
    
    const matchedPriorities = familyProfile.priorities.filter(p => allStr.includes(p.toLowerCase()));
    if (matchedPriorities.length > 0) {
      reasons.push(`${matchedPriorities.slice(0, 2).join(' & ')} focus`);
    }
  }
  
  // Boarding
  if (familyProfile.boardingPreference?.includes('boarding') && school.boarding_available) {
    reasons.push('Boarding available');
  }
  
  return reasons.slice(0, 4);
}

// TIER 1: Hero Section
function HeroTier({ school, familyProfile, matchScore, matchReasons }) {
  const accentColor = 'teal';
  
  return (
    <div className="relative h-96 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      {school.header_photo_url || school.heroImage ? (
        <img
          src={school.header_photo_url || school.heroImage}
          alt={school.name}
          className="w-full h-full object-cover opacity-70"
        />
      ) : null}
      
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
      
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white space-y-4">
        <div>
          <h1 className="text-4xl font-bold">{school.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span>{school.city}, {school.province_state}</span>
            {school.school_type_label && <span className="px-3 py-1 bg-white/20 rounded-full">{school.school_type_label}</span>}
            {school.grades_served && <span className="px-3 py-1 bg-white/20 rounded-full">Grades {school.grades_served}</span>}
            {school.gender_policy && <span className="px-3 py-1 bg-white/20 rounded-full">{school.gender_policy}</span>}
          </div>
        </div>
        
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            {matchReasons.length > 0 && (
              <div className="text-xs space-y-1">
                {matchReasons.map((reason, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-teal-300">
                    <Check className="h-3 w-3" />
                    {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          
        </div>
      </div>
    </div>
  );
}

// TIER 2: Data Grid
function DataGridTier({ school, familyProfile }) {
  const gridItems = [
    { label: 'Enrollment', value: school.enrollment?.toLocaleString() || 'Not available', key: 'enrollment' },
    { label: 'Class Size', value: school.avg_class_size ? String(school.avg_class_size) : 'Not available', key: 'classSize' },
    { label: 'Student-Teacher Ratio', value: school.student_teacher_ratio || 'Not available', key: 'ratio' },
    { label: 'Tuition (Day)', value: school.day_tuition ? `$${school.day_tuition.toLocaleString()}` : 'Not available', key: 'day_tuition' },
    { label: 'Tuition (Boarding)', value: school.boarding_tuition ? `$${school.boarding_tuition.toLocaleString()}` : 'Not available', key: 'boarding_tuition' },
    { label: 'Boarding', value: school.boarding_available ? 'Available' : 'Day Only', key: 'boarding' },
    { label: 'Religion', value: school.faith_based || 'Non-religious', key: 'religion' },
    { label: 'Language', value: school.languages_of_instruction || 'English', key: 'language' },
    { label: 'Founded', value: school.founded ? String(school.founded) : 'Not available', key: 'founded' },
  ];
  
  const isPriority = (key) => {
    if (key === 'day_tuition' && familyProfile?.maxTuition) return true;
    if (key === 'boarding' && familyProfile?.boardingPreference) return true;
    return false;
  };
  
  return (
    <div className="grid grid-cols-2 gap-4 p-6 border-b border-slate-700">
      {gridItems.map((item) => (
        <div key={item.key} className={`p-4 rounded-lg ${isPriority(item.key) ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-slate-800/50'}`}>
          <p className={`text-xs ${isPriority(item.key) ? 'text-teal-400' : 'text-slate-400'}`}>{item.label}</p>
          <p className={`text-lg font-semibold mt-1 ${isPriority(item.key) ? 'text-teal-300' : item.value === 'Not available' ? 'text-slate-500 text-sm' : 'text-white'}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// TIER 3: Detailed Sections
function DetailedSectionsTier({ school }) {
  const noData = <p className="text-sm text-slate-500 italic">Information not available</p>;

  return (
    <div className="p-6 space-y-8 border-b border-slate-700">
      {/* About */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">About</h3>
        {school.mission_statement ? (
          <p className="text-sm text-slate-300 mb-3 italic">"{school.mission_statement}"</p>
        ) : null}
        {school.description ? (
          <p className="text-sm text-slate-400">{school.description}</p>
        ) : !school.mission_statement ? noData : null}
      </div>
      
      {/* Curriculum */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Curriculum & Specializations</h3>
        <div className="space-y-2">
          {school.curriculum && (
            <p className="text-sm text-slate-300"><span className="font-semibold">Type:</span> {school.curriculum}</p>
          )}
          {school.curriculum?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {school.curriculum.map((curr, idx) => (
                <span key={idx} className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs">{curr}</span>
              ))}
            </div>
          ) : null}
          {school.specializations?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {school.specializations.map((spec, idx) => (
                <span key={idx} className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">{spec}</span>
              ))}
            </div>
          ) : null}
          {!school.curriculum && !school.curriculum?.length && !school.specializations?.length ? noData : null}
        </div>
      </div>
      
      {/* Programs */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Programs & Activities</h3>
        <div className="space-y-3">
          {school.arts_programs?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-teal-300 mb-2">Arts</p>
              <div className="flex flex-wrap gap-2">
                {school.arts_programs.slice(0, 6).map((prog, idx) => (
                  <span key={idx} className="text-xs text-slate-400">{prog}</span>
                ))}
              </div>
            </div>
          )}
          {school.sports_programs?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-2">Sports</p>
              <div className="flex flex-wrap gap-2">
                {school.sports_programs.slice(0, 6).map((prog, idx) => (
                  <span key={idx} className="text-xs text-slate-400">{prog}</span>
                ))}
              </div>
            </div>
          )}
          {school.clubs?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-300 mb-2">Clubs</p>
              <div className="flex flex-wrap gap-2">
                {school.clubs.slice(0, 6).map((club, idx) => (
                  <span key={idx} className="text-xs text-slate-400">{club}</span>
                ))}
              </div>
            </div>
          )}
          {!school.arts_programs?.length && !school.sports_programs?.length && !school.clubs?.length ? noData : null}
        </div>
      </div>
      
      {/* Admissions */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Admissions</h3>
        <div className="space-y-2 text-sm text-slate-400">
          {school.day_admission_deadline ? (
            <p><span className="font-semibold text-slate-300">Deadline:</span> {school.day_admission_deadline}</p>
          ) : null}
          {school.admission_requirements?.length > 0 ? (
            <div>
              <p className="font-semibold text-slate-300">Requirements:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {school.admission_requirements.slice(0, 4).map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {school.open_house_dates?.length > 0 ? (
            <p><span className="font-semibold text-slate-300">Open House Dates:</span> {school.open_house_dates.join(', ')}</p>
          ) : null}
          {!school.day_admission_deadline && !school.admission_requirements?.length && !school.open_house_dates?.length ? noData : null}
        </div>
      </div>
    </div>
  );
}

// TIER 4: Reviews/Testimonials (Placeholder)
function ReviewsTier() {
  return (
    <div className="p-6 border-b border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-amber-400" />
        Student & Family Reviews
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <p className="text-slate-400 text-sm">Reviews coming soon. Be the first to share your experience.</p>
      </div>
    </div>
  );
}


// TIER 5: Sticky CTA Bar
function CtaBar({ school, isShortlisted, onToggleShortlist, onCompare, hasTourFeatures, onRequestTour }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 space-y-2 z-40">
      {/* Tour request row */}
      {hasTourFeatures ? (
        <Button
          onClick={onRequestTour}
          className="w-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Request a Tour
        </Button>
      ) : school.claim_status !== 'claimed' ? (
        school.website ? (
          <a href={school.website} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </Button>
          </a>
        ) : null
      ) : (
        school.email ? (
          <a href={`mailto:${school.email}`} className="block w-full">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              Contact School Directly
            </Button>
          </a>
        ) : null
      )}
      {/* Standard actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => window.open(school.website, '_blank')}
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Website
        </Button>
        <Button
          onClick={() => onToggleShortlist(school.id)}
          variant={isShortlisted ? 'default' : 'outline'}
          className={`flex-1 flex items-center justify-center gap-2 ${isShortlisted ? 'bg-red-50 border-red-200 text-red-600' : ''}`}
        >
          <Heart className={`h-4 w-4 ${isShortlisted ? 'fill-red-500 text-red-500' : ''}`} />
          {isShortlisted ? 'Shortlisted' : 'Shortlist'}
        </Button>
        <Button onClick={() => onCompare?.(school.id)} variant="outline" className="flex-1">
          Compare
        </Button>
      </div>
    </div>
  );
}

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
    base44.entities.SchoolEvent.filter({ schoolId: school.id })
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
  const hasAllFeatures = school.school_tier === 'pro';
  const matchScore = calculateMatchScore(school, familyProfile);
  const matchReasons = getMatchReasons(school, familyProfile);

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      {/* Header with Back Button */}
      <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-1 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Results
        </Button>
      </div>
      
      {/* Content Tiers */}
      <div className="flex-1 overflow-auto">
        {/* TIER 1 */}
        <HeroTier school={school} familyProfile={familyProfile} matchScore={matchScore} matchReasons={matchReasons} />
        
        {/* TIER 2 */}
        <DataGridTier school={school} familyProfile={familyProfile} />
        
        {/* TIER 3 */}
        <DetailedSectionsTier school={school} />
        
        {/* TIER 4 */}
        <ReviewsTier />

  
      </div>
      
      {/* TIER 5 */}
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
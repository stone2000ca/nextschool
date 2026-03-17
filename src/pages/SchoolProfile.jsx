import { useState, useEffect, useMemo } from 'react';
import { useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { MapPin, Users, DollarSign, Calendar, Award, Globe2, Heart, Mail, Phone, ExternalLink, CheckCircle2, AlertCircle, Eye, ChevronRight } from "lucide-react";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatEventDate } from '@/components/utils/eventConstants';
import { createPageUrl } from "../utils";
import ContactSchoolModal from '@/components/schools/ContactSchoolModal';
import Navbar from '@/components/navigation/Navbar';
import { HeaderPhotoDisplay, LogoDisplay, isClearbitUrl } from '@/components/schools/HeaderPhotoHelper';

// --- Helpers ---

function gradeLabel(grade) {
  if (grade === null || grade === undefined) return '?';
  if (grade === -2) return 'PK';
  if (grade === -1) return 'JK';
  if (grade === 0) return 'K';
  return String(grade);
}

function f(school, camel, snake) {
  return school[camel] ?? school[snake] ?? null;
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

function parseScholarships(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  try { return JSON.parse(json); } catch { return []; }
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}

function joinProse(arr, conjunction = 'and') {
  if (!arr || arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} ${conjunction} ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, ${conjunction} ${arr[arr.length - 1]}`;
}

function getSchoolTypeLabel(school) {
  const types = [];
  if (school.schoolTypeLabel) return school.schoolTypeLabel;
  if (school.schoolType) return school.schoolType;
  if (school.boardingAvailable) types.push('boarding');
  types.push('private');
  if (school.faithBased) types.push(school.faithBased);
  return types.join(' ');
}

// --- SEO Head Manager ---

function useSchoolSEO(school, slug) {
  useEffect(() => {
    if (!school) return;

    const gradeRange = school.gradesServed || '';
    const city = school.city || '';
    const province = school.provinceState || '';
    const currency = getCurrencySymbol(school.currency);
    const schoolType = getSchoolTypeLabel(school);

    // Title pattern: {name} — {city}, {province} | Grades {range}, Tuition & Reviews | NextSchool
    document.title = `${school.name} — ${city}, ${province} | Grades ${gradeRange}, Tuition & Reviews | NextSchool`;

    // Meta description with city/province for local SEO
    const descParts = [
      `${school.name} is a ${schoolType} ${school.genderPolicy || ''} school in ${city}, ${province} serving grades ${gradeRange}.`,
      school.dayTuition ? `Day tuition from ${currency}${school.dayTuition.toLocaleString()}.` : '',
      school.acceptanceRate ? `${school.acceptanceRate}% acceptance rate.` : '',
      school.enrollment ? `${school.enrollment} students.` : ''
    ].filter(Boolean).join(' ');

    setMeta('description', descParts.substring(0, 160));
    setMeta('robots', 'index, follow');

    // Canonical
    setLink('canonical', `https://nextschool.ca/schools/${slug || school.slug || school.id}`);

    // OG Tags
    const ogUrl = `https://nextschool.ca/schools/${slug || school.slug || school.id}`;
    setMetaProperty('og:title', `${school.name} — ${schoolType} School in ${city} | NextSchool`);
    setMetaProperty('og:description', descParts.substring(0, 200));
    setMetaProperty('og:image', school.headerPhotoUrl || school.logoUrl || '/logo.png');
    setMetaProperty('og:url', ogUrl);
    setMetaProperty('og:type', 'place');
    setMetaProperty('og:site_name', 'NextSchool');

    // Twitter Card
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', `${school.name} — ${city}, ${province}`);
    setMetaName('twitter:description', descParts.substring(0, 200));

    // JSON-LD: School
    setJsonLd('school', buildSchoolSchema(school, ogUrl));

    // JSON-LD: BreadcrumbList
    setJsonLd('breadcrumb', buildBreadcrumbSchema(school, ogUrl));

    // JSON-LD: FAQPage
    setJsonLd('faq', buildFAQSchema(school));

    return () => {
      // Cleanup JSON-LD on unmount
      ['school', 'breadcrumb', 'faq'].forEach(key => {
        const el = document.querySelector(`script[data-schema="${key}"]`);
        if (el) el.remove();
      });
    };
  }, [school, slug]);
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setMetaName(name, content) { setMeta(name, content); }

function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
  el.content = content;
}

function setLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
}

function setJsonLd(key, data) {
  let el = document.querySelector(`script[data-schema="${key}"]`);
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.setAttribute('data-schema', key); document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

function buildSchoolSchema(school, url) {
  const website = school.website ? (school.website.startsWith('http') ? school.website : `https://${school.website}`) : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: school.name,
    url,
    ...(school.logoUrl && { logo: school.logoUrl }),
    ...(school.headerPhotoUrl && { image: school.headerPhotoUrl }),
    description: school.description || school.missionStatement || '',
    address: {
      '@type': 'PostalAddress',
      ...(school.address && { streetAddress: school.address }),
      addressLocality: school.city || '',
      addressRegion: school.provinceState || '',
      addressCountry: school.country || 'CA'
    },
    ...(school.lat && school.lng && {
      geo: { '@type': 'GeoCoordinates', latitude: school.lat, longitude: school.lng }
    }),
    ...(school.phone && { telephone: school.phone }),
    ...(school.email && { email: school.email }),
    ...(school.founded && { foundingDate: String(school.founded) }),
    ...(school.enrollment && { numberOfStudents: school.enrollment }),
    ...(website && { sameAs: website }),
    areaServed: { '@type': 'City', name: school.city || '' },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Tuition',
      itemListElement: [
        ...(school.dayTuition ? [{
          '@type': 'Offer', name: 'Day Tuition',
          price: String(school.dayTuition),
          priceCurrency: school.currency || 'CAD'
        }] : []),
        ...(school.boardingTuition ? [{
          '@type': 'Offer', name: 'Boarding Tuition',
          price: String(school.boardingTuition),
          priceCurrency: school.currency || 'CAD'
        }] : [])
      ]
    }
  };
}

function buildBreadcrumbSchema(school, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'NextSchool', item: 'https://nextschool.ca' },
      { '@type': 'ListItem', position: 2, name: 'Schools', item: 'https://nextschool.ca/schools' },
      ...(school.provinceState ? [{ '@type': 'ListItem', position: 3, name: school.provinceState, item: `https://nextschool.ca/schools?province=${encodeURIComponent(school.provinceState)}` }] : []),
      ...(school.city ? [{ '@type': 'ListItem', position: school.provinceState ? 4 : 3, name: school.city, item: `https://nextschool.ca/schools?city=${encodeURIComponent(school.city)}` }] : []),
      { '@type': 'ListItem', position: (school.provinceState ? 4 : 3) + (school.city ? 1 : 0), name: school.name, item: url }
    ]
  };
}

function buildFAQSchema(school) {
  const currency = getCurrencySymbol(school.currency);
  const faqs = [];

  if (school.gradesServed) {
    faqs.push({
      '@type': 'Question', name: `What grades does ${school.name} serve?`,
      acceptedAnswer: { '@type': 'Answer', text: `${school.name} serves students in grades ${school.gradesServed}.` }
    });
  }
  if (school.dayTuition) {
    let text = `Day tuition at ${school.name} is ${currency}${school.dayTuition.toLocaleString()}/year.`;
    if (school.boardingTuition) text += ` Boarding tuition is ${currency}${school.boardingTuition.toLocaleString()}/year.`;
    if (school.financialAidAvailable) text += ` Financial aid is available.`;
    faqs.push({ '@type': 'Question', name: `How much is tuition at ${school.name}?`, acceptedAnswer: { '@type': 'Answer', text } });
  }
  if (school.dayAdmissionDeadline || school.acceptanceRate) {
    let text = '';
    if (school.dayAdmissionDeadline) text += `The application deadline is ${school.dayAdmissionDeadline}. `;
    if (school.acceptanceRate) text += `The acceptance rate is ${school.acceptanceRate}%.`;
    faqs.push({ '@type': 'Question', name: `How do I apply to ${school.name}?`, acceptedAnswer: { '@type': 'Answer', text: text.trim() } });
  }
  if (school.boardingAvailable !== undefined) {
    const boardingType = f(school, 'boardingType', 'boarding_type');
    const boardingPct = f(school, 'boardingPct', 'boarding_pct');
    let text = school.boardingAvailable
      ? `Yes, ${school.name} offers ${boardingType || 'boarding'}.${boardingPct ? ` ${boardingPct}% of students are boarders.` : ''}`
      : `No, ${school.name} is a day school only.`;
    faqs.push({ '@type': 'Question', name: `Does ${school.name} offer boarding?`, acceptedAnswer: { '@type': 'Answer', text } });
  }
  if (school.studentTeacherRatio || school.avgClassSize) {
    let text = '';
    if (school.studentTeacherRatio) text += `The student-teacher ratio is ${school.studentTeacherRatio}. `;
    if (school.avgClassSize) text += `Average class size is ${school.avgClassSize} students. `;
    if (school.enrollment) text += `Total enrollment is ${school.enrollment}.`;
    faqs.push({ '@type': 'Question', name: `What is the student-teacher ratio at ${school.name}?`, acceptedAnswer: { '@type': 'Answer', text: text.trim() } });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
  };
}


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SchoolProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams();

  // Support both /schools/:slug and legacy /SchoolProfile?id=
  const legacyId = new URLSearchParams(location.search).get('id');
  const schoolId = slug ? null : legacyId;

  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [relatedSchools, setRelatedSchools] = useState([]);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 11));

  // Load school by slug or ID
  useEffect(() => {
    const loadSchool = async () => {
      setLoading(true);
      try {
        let schools;
        if (slug) {
          schools = await base44.entities.School.filter({ slug });
        } else if (schoolId) {
          schools = await base44.entities.School.filter({ id: schoolId });
        }
        if (schools && schools.length > 0) {
          const s = schools[0];
          setSchool(s);

          // If accessed via legacy URL, redirect to slug URL
          if (!slug && s.slug) {
            navigate(`/schools/${s.slug}`, { replace: true });
          }
        }
      } catch (error) {
        console.error('Failed to load school:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchool();
    checkAuth();
  }, [slug, schoolId]);

  // Track page view
  useEffect(() => {
    if (!school) return;
    base44.functions.invoke('trackSessionEvent', {
      eventType: 'page_view',
      sessionId,
      metadata: { page: 'SchoolProfile', schoolId: school.id }
    }).catch(() => {});
  }, [school, sessionId]);

  // Load testimonials
  useEffect(() => {
    if (!school?.id) return;
    base44.entities.Testimonial.filter({ schoolId: school.id, is_visible: true })
      .then(setTestimonials)
      .catch(() => {});
  }, [school?.id]);

  // Load upcoming events
  useEffect(() => {
    if (!school?.id) return;
    setLoadingEvents(true);
    const now = new Date().toISOString();
    base44.entities.SchoolEvent.filter({ schoolId: school.id, isActive: true, date: { $gte: now } })
      .then(events => {
        const sorted = (events || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        setUpcomingEvents(sorted.slice(0, 3));
      })
      .catch(() => setUpcomingEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [school?.id]);

  // Load related schools (same city, different school)
  useEffect(() => {
    if (!school?.city) return;
    base44.entities.School.filter({ city: school.city })
      .then(schools => {
        const others = (schools || []).filter(s => s.id !== school.id).slice(0, 4);
        setRelatedSchools(others);
      })
      .catch(() => {});
  }, [school?.city, school?.id]);

  // SEO hooks
  useSchoolSEO(school, slug);

  const checkAuth = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      if (authenticated) {
        const userData = await base44.auth.me();
        setUser(userData);
        setIsShortlisted(userData.shortlist?.includes(school?.id || schoolId) || false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const handleToggleShortlist = async () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname + window.location.search);
      return;
    }
    try {
      const sid = school?.id || schoolId;
      const currentShortlist = user.shortlist || [];
      const newShortlist = isShortlisted
        ? currentShortlist.filter(id => id !== sid)
        : [...currentShortlist, sid];
      await base44.auth.updateMe({ shortlist: newShortlist });
      setIsShortlisted(!isShortlisted);
      setUser({ ...user, shortlist: newShortlist });
    } catch (error) {
      console.error('Failed to update shortlist:', error);
    }
  };

  // --- Derived values ---
  const currency = school?.currency || 'CAD';
  const sym = getCurrencySymbol(currency);
  const gradeRange = school?.gradesServed || '';
  const lowestGradeLabel = school?.lowestGrade != null ? gradeLabel(school.lowestGrade) : null;
  const highestGradeLabel = school?.highestGrade != null ? gradeLabel(school.highestGrade) : null;
  const computedGradeRange = lowestGradeLabel && highestGradeLabel ? `${lowestGradeLabel} – ${highestGradeLabel}` : gradeRange;

  const boardingType = f(school || {}, 'boardingType', 'boarding_type');
  const boardingPct = f(school || {}, 'boardingPct', 'boarding_pct');
  const campusSize = f(school || {}, 'campusSize', 'campus_size');
  const internationalPct = f(school || {}, 'internationalStudentPct', 'international_student_pct');
  const facilities = f(school || {}, 'facilities', 'facilities') || [];
  const livingArrangements = f(school || {}, 'livingArrangements', 'living_arrangements') || [];
  const transportationOptions = f(school || {}, 'transportationOptions', 'transportation_options') || [];
  const academicCulture = f(school || {}, 'academicCulture', 'academic_culture');
  const pace = f(school || {}, 'pace', 'pace');
  const focus = f(school || {}, 'focus', 'focus');
  const mathApproach = f(school || {}, 'mathApproach', 'math_approach');
  const scienceApproach = f(school || {}, 'scienceApproach', 'science_approach');
  const homeworkByGrade = f(school || {}, 'homeworkByGrade', 'homework_by_grade');
  const specialEdPrograms = f(school || {}, 'specialEdPrograms', 'special_ed_programs') || [];
  const communityVibe = f(school || {}, 'communityVibe', 'community_vibe');
  const universityPlacements = f(school || {}, 'universityPlacements', 'university_placements') || [];
  const applicationProcess = f(school || {}, 'applicationProcess', 'application_process') || [];
  const boardingDeadline = f(school || {}, 'boardingAdmissionDeadline', 'boarding_admission_deadline');
  const tuitionNotes = f(school || {}, 'tuitionNotes', 'tuition_notes');
  const scholarshipsRaw = f(school || {}, 'scholarshipsJson', 'scholarships_json');
  const scholarships = parseScholarships(scholarshipsRaw);
  const dayTuitionMin = school?.dayTuition || f(school || {}, 'dayTuitionMin', 'day_tuition_min');
  const dayTuitionMax = f(school || {}, 'dayTuitionMax', 'day_tuition_max');
  const boardingTuitionMin = school?.boardingTuition || f(school || {}, 'boardingTuitionMin', 'boarding_tuition_min');
  const boardingTuitionMax = f(school || {}, 'boardingTuitionMax', 'boarding_tuition_max');
  const financialAidPct = f(school || {}, 'financialAidPct', 'financial_aid_pct');
  const medianAidAmount = f(school || {}, 'medianAidAmount', 'median_aid_amount');
  const languagesOfInstruction = f(school || {}, 'languagesOfInstruction', 'languages_of_instruction') || school?.languages || [];
  const entranceRequirements = school?.admissionRequirements || f(school || {}, 'entranceRequirements', 'entrance_requirements') || [];

  // --- Loading / Not Found ---

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">School Not Found</h2>
          <Link to={createPageUrl('Consultant')}>
            <Button>Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  const schoolTypeLabel = getSchoolTypeLabel(school);
  const websiteUrl = school.website ? (school.website.startsWith('http') ? school.website : `https://${school.website}`) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* ============================================================ */}
      {/* 1. BREADCRUMBS — Schema.org BreadcrumbList                   */}
      {/* ============================================================ */}
      <nav aria-label="Breadcrumb" className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <li><Link to="/" className="hover:text-teal-600">NextSchool</Link></li>
            <li><ChevronRight className="h-3 w-3" /></li>
            <li><Link to="/SchoolDirectory" className="hover:text-teal-600">Schools</Link></li>
            {school.provinceState && (
              <>
                <li><ChevronRight className="h-3 w-3" /></li>
                <li><Link to={`/SchoolDirectory?province=${encodeURIComponent(school.provinceState)}`} className="hover:text-teal-600">{school.provinceState}</Link></li>
              </>
            )}
            {school.city && (
              <>
                <li><ChevronRight className="h-3 w-3" /></li>
                <li><Link to={`/SchoolDirectory?city=${encodeURIComponent(school.city)}`} className="hover:text-teal-600">{school.city}</Link></li>
              </>
            )}
            <li><ChevronRight className="h-3 w-3" /></li>
            <li className="text-slate-900 font-medium truncate max-w-[200px]" aria-current="page">{school.name}</li>
          </ol>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* 2. HERO + H1                                                 */}
      {/* ============================================================ */}
      <header className="relative h-56 sm:h-80 lg:h-96 bg-slate-200">
        <img
          src={school.headerPhotoUrl || school.heroImage || `https://via.placeholder.com/1200x675/e2e8f0/64748b?text=${encodeURIComponent(school.name)}`}
          alt={`${school.name} campus in ${school.city}, ${school.provinceState}`}
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {school.logoUrl && !isClearbitUrl(school.headerPhotoUrl) && (
          <div className="absolute bottom-0 left-0 p-4 sm:p-8 pb-0">
            <div className="transform translate-y-1/2">
              <img
                src={school.logoUrl}
                alt={`${school.name} logo`}
                className="h-16 sm:h-24 w-16 sm:w-24 rounded-lg bg-white p-2 shadow-lg object-contain"
                loading="eager"
              />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              {school.logoUrl && isClearbitUrl(school.headerPhotoUrl) && (
                <img
                  src={school.logoUrl}
                  alt={`${school.name} logo`}
                  className="h-8 sm:h-12 w-8 sm:w-12 rounded-lg bg-white p-1 sm:p-2 shadow-lg object-contain"
                  loading="eager"
                />
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                {school.name} — {schoolTypeLabel.charAt(0).toUpperCase() + schoolTypeLabel.slice(1)} School in {school.city}, {school.provinceState}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-white/90">
              {schoolTypeLabel.charAt(0).toUpperCase() + schoolTypeLabel.slice(1)} · {school.genderPolicy || 'Co-ed'} · Grades {computedGradeRange}
              {school.faithBased ? ` · ${school.faithBased}` : ''}
            </p>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. QUICK FACTS BAR — Semantic <dl>                           */}
      {/* ============================================================ */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <dl className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {computedGradeRange && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Grades</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{computedGradeRange}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs sm:text-sm text-slate-500">Enrollment</dt>
              <dd className="text-base sm:text-xl font-bold text-slate-900">{school.enrollment ? `${school.enrollment.toLocaleString()} students` : 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-xs sm:text-sm text-slate-500">Day Tuition</dt>
              <dd className="text-base sm:text-xl font-bold text-slate-900">
                {dayTuitionMin ? `${sym}${dayTuitionMin.toLocaleString()}/yr` : 'N/A'}
              </dd>
            </div>
            {school.avgClassSize && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Class Size</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{school.avgClassSize} students</dd>
              </div>
            )}
            {school.studentTeacherRatio && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Student-Teacher Ratio</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{school.studentTeacherRatio}</dd>
              </div>
            )}
            {school.acceptanceRate && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Acceptance Rate</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{school.acceptanceRate}%</dd>
              </div>
            )}
            {school.founded && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Founded</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{school.founded}</dd>
              </div>
            )}
            {campusSize && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">Campus</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{campusSize} acres</dd>
              </div>
            )}
            {internationalPct && (
              <div>
                <dt className="text-xs sm:text-sm text-slate-500">International Students</dt>
                <dd className="text-base sm:text-xl font-bold text-slate-900">{internationalPct}%</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN CONTENT + SIDEBAR                                       */}
      {/* ============================================================ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">

          {/* --- LEFT: Content Sections --- */}
          <div className="lg:col-span-2 space-y-8">

            {/* ======================================================== */}
            {/* 4. ABOUT SECTION                                         */}
            {/* ======================================================== */}
            {(school.description || school.missionStatement || school.teachingPhilosophy) && (
              <article className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">About {school.name}</h2>

                {school.missionStatement && (
                  <blockquote className="border-l-4 border-teal-500 pl-4 my-4 text-slate-700 italic">
                    {school.missionStatement}
                  </blockquote>
                )}

                {school.description && (
                  <p className="text-slate-700 leading-relaxed mb-4">{school.description}</p>
                )}

                {school.values && school.values.length > 0 && (
                  <p className="text-slate-700 mb-3">
                    <strong>Core Values:</strong> {joinProse(school.values)}
                  </p>
                )}

                {school.teachingPhilosophy && (
                  <p className="text-slate-700">
                    <strong>Teaching Philosophy:</strong> {school.teachingPhilosophy}
                  </p>
                )}
              </article>
            )}

            {/* ======================================================== */}
            {/* Highlights (if any)                                      */}
            {/* ======================================================== */}
            {school.highlights && school.highlights.length > 0 && (
              <section className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200 p-6 sm:p-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-teal-600" />
                  What Makes {school.name} Special
                </h2>
                <ul className="space-y-2">
                  {school.highlights.slice(0, 5).map((highlight, idx) => (
                    <li key={idx} className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <span className="text-teal-900">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ======================================================== */}
            {/* 5. ACADEMICS & CURRICULUM                                */}
            {/* ======================================================== */}
            {(school.curriculum || academicCulture || pace || focus || specialEdPrograms.length > 0 || languagesOfInstruction.length > 0) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Academics at {school.name}</h2>

                {school.curriculum && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Curriculum</h3>
                    <p className="text-slate-700 mb-4">
                      {school.name} offers {Array.isArray(school.curriculum) ? joinProse(school.curriculum) : school.curriculum} curriculum{Array.isArray(school.curriculum) && school.curriculum.length > 1 ? 's' : ''}
                      {school.specializations && school.specializations.length > 0 ? `, with specializations in ${joinProse(school.specializations)}.` : '.'}
                    </p>
                  </>
                )}

                {(academicCulture || pace || focus || mathApproach || scienceApproach || homeworkByGrade) && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Academic Environment</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {academicCulture && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Academic Culture</dt><dd className="text-sm font-medium text-slate-800">{academicCulture}</dd></div>}
                      {pace && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Pace</dt><dd className="text-sm font-medium text-slate-800">{pace}</dd></div>}
                      {focus && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Focus</dt><dd className="text-sm font-medium text-slate-800">{focus}</dd></div>}
                      {mathApproach && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Math Approach</dt><dd className="text-sm font-medium text-slate-800">{mathApproach}</dd></div>}
                      {scienceApproach && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Science Approach</dt><dd className="text-sm font-medium text-slate-800">{scienceApproach}</dd></div>}
                      {homeworkByGrade && <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Homework Load</dt><dd className="text-sm font-medium text-slate-800">{typeof homeworkByGrade === 'string' ? homeworkByGrade : JSON.stringify(homeworkByGrade)}</dd></div>}
                    </dl>
                  </>
                )}

                {languagesOfInstruction.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Languages of Instruction</h3>
                    <p className="text-slate-700 mb-4">Classes are taught in {joinProse(languagesOfInstruction)}.</p>
                  </>
                )}

                {specialEdPrograms.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Learning Support</h3>
                    <p className="text-slate-700">{joinProse(specialEdPrograms)}</p>
                  </>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 6. PROGRAMS & ACTIVITIES                                 */}
            {/* ======================================================== */}
            {(school.artsPrograms?.length > 0 || school.sportsPrograms?.length > 0 || school.clubs?.length > 0) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Programs & Extracurriculars at {school.name}</h2>

                {school.artsPrograms?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Arts Programs</h3>
                    <p className="text-slate-700 mb-4">{school.name} offers {joinProse(school.artsPrograms)}.</p>
                  </>
                )}

                {school.sportsPrograms?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Sports</h3>
                    <p className="text-slate-700 mb-4">Athletic programs include {joinProse(school.sportsPrograms)}.</p>
                  </>
                )}

                {school.clubs?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Clubs & Activities</h3>
                    <p className="text-slate-700">Students can join {joinProse(school.clubs)}.</p>
                  </>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 7. CAMPUS & FACILITIES                                   */}
            {/* ======================================================== */}
            {(campusSize || facilities.length > 0 || school.boardingAvailable || transportationOptions.length > 0 || school.photoGallery?.length > 0 || school.virtualTourUrl) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Campus & Facilities</h2>

                {(campusSize || facilities.length > 0) && (
                  <p className="text-slate-700 mb-4">
                    {school.name}{campusSize ? ` sits on a ${campusSize}-acre campus` : ' features a campus'}
                    {facilities.length > 0 ? ` with ${joinProse(facilities)}.` : '.'}
                  </p>
                )}

                {school.boardingAvailable && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Boarding Life</h3>
                    <p className="text-slate-700 mb-4">
                      {boardingType ? `Boarding type: ${boardingType}.` : ''}
                      {livingArrangements.length > 0 ? ` Living arrangements include ${joinProse(livingArrangements)}.` : ''}
                      {boardingPct ? ` ${boardingPct}% of students board.` : ''}
                    </p>
                  </>
                )}

                {transportationOptions.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Transportation</h3>
                    <p className="text-slate-700 mb-4">{joinProse(transportationOptions)}</p>
                  </>
                )}

                {school.photoGallery && school.photoGallery.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Photo Gallery</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {school.photoGallery.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`${school.name} campus photo ${index + 1}`}
                          className="rounded-lg w-full h-32 sm:h-40 object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </>
                )}

                {school.virtualTourUrl && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Virtual Tour</h3>
                    <a href={school.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium">
                      <Eye className="h-4 w-4" />
                      Take a virtual tour of {school.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 8. TUITION & FINANCIAL AID                               */}
            {/* ======================================================== */}
            {(dayTuitionMin || boardingTuitionMin || school.financialAidAvailable !== undefined) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Tuition & Financial Aid at {school.name}</h2>

                <p className="text-slate-700 mb-4">
                  {dayTuitionMin && `Day tuition at ${school.name} ${dayTuitionMax && dayTuitionMax !== dayTuitionMin ? `ranges from ${sym}${dayTuitionMin.toLocaleString()} to ${sym}${dayTuitionMax.toLocaleString()}` : `is ${sym}${dayTuitionMin.toLocaleString()}`} per year.`}
                  {boardingTuitionMin && ` Boarding tuition is ${boardingTuitionMax && boardingTuitionMax !== boardingTuitionMin ? `${sym}${boardingTuitionMin.toLocaleString()}–${sym}${boardingTuitionMax.toLocaleString()}` : `${sym}${boardingTuitionMin.toLocaleString()}`}/yr.`}
                </p>

                {(school.financialAidAvailable !== undefined || financialAidPct || medianAidAmount) && (
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {school.financialAidAvailable !== undefined && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <dt className="text-xs text-slate-500 mb-1">Financial Aid</dt>
                        <dd className="text-sm font-medium text-slate-800">{school.financialAidAvailable ? 'Available' : 'Not available'}</dd>
                      </div>
                    )}
                    {financialAidPct && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <dt className="text-xs text-slate-500 mb-1">Students Receiving Aid</dt>
                        <dd className="text-sm font-medium text-slate-800">{financialAidPct}%</dd>
                      </div>
                    )}
                    {medianAidAmount && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <dt className="text-xs text-slate-500 mb-1">Median Aid Package</dt>
                        <dd className="text-sm font-medium text-slate-800">{sym}{medianAidAmount.toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {tuitionNotes && (
                  <p className="text-sm text-slate-500 italic mb-4">{tuitionNotes}</p>
                )}

                {scholarships.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Scholarships</h3>
                    <ul className="space-y-2">
                      {scholarships.map((s, i) => (
                        <li key={i} className="bg-slate-50 rounded-lg p-3">
                          <span className="font-medium text-slate-800">{s.name || s.title || `Scholarship ${i + 1}`}</span>
                          {(s.amount || s.description) && (
                            <span className="text-sm text-slate-600 ml-2">
                              {s.amount ? `— ${sym}${s.amount.toLocaleString()}` : ''} {s.description || ''}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 9. ADMISSIONS                                            */}
            {/* ======================================================== */}
            {(school.dayAdmissionDeadline || boardingDeadline || applicationProcess.length > 0 || entranceRequirements.length > 0 || school.acceptanceRate || upcomingEvents.length > 0) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Admissions at {school.name}</h2>

                <p className="text-slate-700 mb-4">
                  {school.dayAdmissionDeadline && `The application deadline for day students is ${school.dayAdmissionDeadline}.`}
                  {boardingDeadline && ` Boarding application deadline is ${boardingDeadline}.`}
                  {school.acceptanceRate && ` The acceptance rate is ${school.acceptanceRate}%.`}
                </p>

                {applicationProcess.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Application Process</h3>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 mb-4">
                      {applicationProcess.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </>
                )}

                {entranceRequirements.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Requirements</h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 mb-4">
                      {entranceRequirements.map((req, i) => <li key={i}>{req}</li>)}
                    </ul>
                  </>
                )}

                {!loadingEvents && upcomingEvents.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Open Houses & Events</h3>
                    <div className="space-y-3">
                      {upcomingEvents.map(event => (
                        <div key={event.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <div className="flex items-start gap-3 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${EVENT_TYPE_COLORS[event.eventType] || 'bg-slate-100 text-slate-600'}`}>
                              {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                            </span>
                            {event.source === 'school_portal' ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                <CheckCircle2 className="h-3 w-3" /> Confirmed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                <AlertCircle className="h-3 w-3" /> Listed on website
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 mb-1">{event.title}</p>
                          <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatEventDate(event.date)}
                          </p>
                          {event.description && (
                            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{event.description}</p>
                          )}
                          {event.registrationUrl && (
                            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">Register</Button>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 10. OUTCOMES & ALUMNI                                    */}
            {/* ======================================================== */}
            {universityPlacements.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">University Placements & Outcomes</h2>
                <p className="text-slate-700">
                  Graduates of {school.name} go on to attend {joinProse(universityPlacements)}.
                </p>
              </section>
            )}

            {/* ======================================================== */}
            {/* 11. COMMUNITY & VIBE                                     */}
            {/* ======================================================== */}
            {communityVibe && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Community & Culture at {school.name}</h2>
                <p className="text-slate-700">{communityVibe}</p>
              </section>
            )}

            {/* ======================================================== */}
            {/* 12. TESTIMONIALS — Schema.org Review                     */}
            {/* ======================================================== */}
            {testimonials.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Reviews & Testimonials</h2>
                <p className="text-xs text-slate-500 mb-4">Provided by {school.name}</p>
                <div className="space-y-4">
                  {testimonials.map(t => (
                    <div key={t.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100"
                      itemScope itemType="https://schema.org/Review">
                      <p className="text-slate-700 leading-relaxed italic mb-3" itemProp="reviewBody">
                        &ldquo;{t.quote_text}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-medium text-slate-700" itemProp="author">{t.author_first_name}</span>
                        <span>&middot;</span>
                        <span className="capitalize">{t.author_role}</span>
                        {t.year_submitted && <><span>&middot;</span><span>{t.year_submitted}</span></>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* 13. ACCREDITATIONS & AWARDS                              */}
            {/* ======================================================== */}
            {((school.accreditations && school.accreditations.length > 0) || (school.awards && school.awards.length > 0)) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Accreditations & Recognition</h2>
                {school.accreditations && school.accreditations.length > 0 && (
                  <p className="text-slate-700 mb-3">
                    {school.name} is accredited by {joinProse(school.accreditations)}.
                  </p>
                )}
                {school.awards && school.awards.length > 0 && (
                  <p className="text-slate-700">
                    Awards: {joinProse(school.awards)}
                  </p>
                )}
              </section>
            )}

            {/* ======================================================== */}
            {/* 14. CONTACT & LOCATION — Semantic <address>              */}
            {/* ======================================================== */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Contact {school.name}</h2>
              <address className="not-italic text-slate-700 space-y-2">
                {school.address && <p>{school.address}, {school.city}, {school.provinceState}</p>}
                {!school.address && school.city && <p>{school.city}, {school.provinceState}</p>}
                {school.phone && (
                  <p>Phone: <a href={`tel:${school.phone}`} className="text-teal-600 hover:underline">{school.phone}</a></p>
                )}
                {school.email && (
                  <p>Email: <a href={`mailto:${school.email}`} className="text-teal-600 hover:underline">{school.email}</a></p>
                )}
                {websiteUrl && (
                  <p>
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-600 hover:underline">
                      Visit School Website <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
              </address>
            </section>

            {/* ======================================================== */}
            {/* 15. RELATED SCHOOLS — Internal linking                   */}
            {/* ======================================================== */}
            {relatedSchools.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Similar Schools Near {school.city}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedSchools.map(rs => (
                    <Link
                      key={rs.id}
                      to={rs.slug ? `/schools/${rs.slug}` : `/SchoolProfile?id=${rs.id}`}
                      className="block bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-teal-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <LogoDisplay logoUrl={rs.logoUrl} schoolName={rs.name} schoolWebsite={rs.website} size="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{rs.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {rs.city}{rs.gradesServed ? ` · Grades ${rs.gradesServed}` : ''}
                            {rs.dayTuition ? ` · ${getCurrencySymbol(rs.currency)}${rs.dayTuition.toLocaleString()}` : ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* 16. FAQ SECTION — Schema.org FAQPage                     */}
            {/* ======================================================== */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8" itemScope itemType="https://schema.org/FAQPage">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Frequently Asked Questions about {school.name}</h2>

              {computedGradeRange && (
                <div className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">What grades does {school.name} serve?</h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-700" itemProp="text">
                      {school.name} serves students from {lowestGradeLabel ? `Grade ${lowestGradeLabel}` : ''} through Grade {highestGradeLabel || ''}, covering grades {computedGradeRange}.
                    </p>
                  </div>
                </div>
              )}

              {dayTuitionMin && (
                <div className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">How much is tuition at {school.name}?</h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-700" itemProp="text">
                      Day tuition at {school.name} is {sym}{dayTuitionMin.toLocaleString()}/year.
                      {boardingTuitionMin ? ` Boarding tuition is ${sym}${boardingTuitionMin.toLocaleString()}/year.` : ''}
                      {school.financialAidAvailable ? ` Financial aid is available` : ''}
                      {financialAidPct ? `, with ${financialAidPct}% of students receiving assistance.` : school.financialAidAvailable ? '.' : ''}
                    </p>
                  </div>
                </div>
              )}

              {(school.dayAdmissionDeadline || entranceRequirements.length > 0 || school.acceptanceRate) && (
                <div className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">How do I apply to {school.name}?</h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-700" itemProp="text">
                      {school.dayAdmissionDeadline ? `The application deadline is ${school.dayAdmissionDeadline}. ` : ''}
                      {entranceRequirements.length > 0 ? `Requirements include ${joinProse(entranceRequirements)}. ` : ''}
                      {school.acceptanceRate ? `The acceptance rate is ${school.acceptanceRate}%.` : ''}
                    </p>
                  </div>
                </div>
              )}

              {school.boardingAvailable !== undefined && (
                <div className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">Does {school.name} offer boarding?</h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-700" itemProp="text">
                      {school.boardingAvailable
                        ? `Yes, ${school.name} offers ${boardingType || 'boarding'}. ${boardingPct ? `${boardingPct}% of students are boarders.` : ''} ${livingArrangements.length > 0 ? `Living arrangements include ${joinProse(livingArrangements)}.` : ''}`
                        : `No, ${school.name} is a day school only.`
                      }
                    </p>
                  </div>
                </div>
              )}

              {(school.studentTeacherRatio || school.avgClassSize) && (
                <div className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">What is the student-teacher ratio at {school.name}?</h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-700" itemProp="text">
                      {school.studentTeacherRatio ? `The student-teacher ratio is ${school.studentTeacherRatio}.` : ''}
                      {school.avgClassSize ? ` Average class size is ${school.avgClassSize} students.` : ''}
                      {school.enrollment ? ` Total enrollment is ${school.enrollment}.` : ''}
                    </p>
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* --- RIGHT: SIDEBAR --- */}
          <aside className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 lg:sticky lg:top-24">
              <Button
                className="w-full mb-3 bg-teal-600 hover:bg-teal-700 text-sm sm:text-base"
                onClick={() => setShowContactModal(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact This School
              </Button>
              <Button
                className={`w-full mb-4 text-sm sm:text-base ${isShortlisted ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                variant={isShortlisted ? "default" : "outline"}
                onClick={handleToggleShortlist}
              >
                <Heart className={`h-4 w-4 mr-2 ${isShortlisted ? 'fill-current' : ''}`} />
                {isShortlisted ? 'Shortlisted' : 'Add to Shortlist'}
              </Button>

              {/* Claim Button / Badge */}
              {(!school.claimStatus || school.claimStatus === 'unclaimed') && (
                <Link to={`${createPageUrl('ClaimSchool')}?schoolId=${school.id}`} className="block w-full">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 mb-4">Claim This School</Button>
                </Link>
              )}
              {school.claimStatus === 'pending' && (
                <div className="w-full px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center mb-4">Claim in Progress</div>
              )}
              {school.claimStatus === 'claimed' && (
                <div className="w-full px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-sm text-center mb-4">Managed by school</div>
              )}

              <div className="space-y-3 sm:space-y-4">
                <h3 className="font-bold text-sm sm:text-base">Contact Information</h3>
                {school.phone && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Phone className="h-3 sm:h-4 w-3 sm:w-4 text-slate-400 flex-shrink-0" />
                    <a href={`tel:${school.phone}`} className="hover:text-teal-600">{school.phone}</a>
                  </div>
                )}
                {school.email && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Mail className="h-3 sm:h-4 w-3 sm:w-4 text-slate-400 flex-shrink-0" />
                    <a href={`mailto:${school.email}`} className="text-teal-600 hover:underline truncate">{school.email}</a>
                  </div>
                )}
                {websiteUrl && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Globe2 className="h-3 sm:h-4 w-3 sm:w-4 text-slate-400 flex-shrink-0" />
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1 truncate">
                      Visit Website <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {school.accreditations && school.accreditations.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-bold mb-2 text-sm">Accreditations</h3>
                  <div className="flex flex-wrap gap-2">
                    {school.accreditations.map((acc, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">{acc}</span>
                    ))}
                  </div>
                </div>
              )}

              {school.verified && (
                <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-teal-700">
                  <Award className="h-4 w-4" />
                  <span className="font-medium">Verified School Profile</span>
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 17. LAST UPDATED FOOTER                                      */}
      {/* ============================================================ */}
      <footer className="bg-slate-100 border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500">
          {school.updatedAt && (
            <p className="mb-2">
              Information last updated {formatDate(school.updatedAt || school.updated_at)}.
              Data sourced from school records and public information.
            </p>
          )}
          <p className="flex flex-wrap gap-2">
            <Link to="/SchoolDirectory" className="text-teal-600 hover:underline">Browse all private schools</Link>
            <span>&middot;</span>
            {school.provinceState && (
              <>
                <Link to={`/SchoolDirectory?province=${encodeURIComponent(school.provinceState)}`} className="text-teal-600 hover:underline">Schools in {school.provinceState}</Link>
                <span>&middot;</span>
              </>
            )}
            {school.city && (
              <Link to={`/SchoolDirectory?city=${encodeURIComponent(school.city)}`} className="text-teal-600 hover:underline">Schools in {school.city}</Link>
            )}
          </p>
        </div>
      </footer>

      {showContactModal && (
        <ContactSchoolModal
          school={school}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </div>
  );
}

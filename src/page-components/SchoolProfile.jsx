import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { School as SchoolEntity, Testimonial, SchoolEvent } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';
import { Button } from "@/components/ui/button";
import { MapPin, Users, DollarSign, Calendar, Award, Globe2, Mail, Phone, ExternalLink, CheckCircle2, AlertCircle, Eye, ChevronRight, MessageCircle } from "lucide-react";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatEventDate } from '@/components/utils/eventConstants';
import Navbar from '@/components/navigation/Navbar';
import { LogoDisplay, isClearbitUrl } from '@/components/schools/HeaderPhotoHelper';

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
  if (school.school_type_label) return school.school_type_label;
  if (school.school_type) return school.school_type;
  const types = [];
  if (school.boarding_available) types.push('boarding');
  types.push('private');
  if (school.faith_based) types.push(school.faith_based);
  return types.join(' ');
}

// --- Chat CTA Helper ---

function ConsultantCTA({ school, text, variant = 'inline' }) {
  const slug = school?.slug || school?.id;
  const href = `/consultant?school=${encodeURIComponent(slug)}`;

  if (variant === 'sticky') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-700 hidden sm:block">Want personalized guidance on <strong>{school.name}</strong>?</p>
          <p className="text-sm text-slate-700 sm:hidden">Need guidance?</p>
          <Link href={href} className="flex-shrink-0">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white text-sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat with a Consultant
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <p className="text-sm sm:text-base text-teal-900">{text}</p>
      <Link href={href} className="flex-shrink-0">
        <Button className="bg-teal-600 hover:bg-teal-700 text-white text-sm whitespace-nowrap">
          <MessageCircle className="h-4 w-4 mr-2" />
          Talk to a Consultant
        </Button>
      </Link>
    </div>
  );
}

// --- Dynamic FAQ Generator (up to 20 questions) ---

function generateSchoolFAQs(school, events) {
  const name = school.name;
  const sym = getCurrencySymbol(school.currency);
  const faqs = [];

  // 1. Grades (always if available)
  if (school.grades_served || (school.lowest_grade != null && school.highest_grade != null)) {
    const range = school.grades_served || `${gradeLabel(school.lowest_grade)} – ${gradeLabel(school.highest_grade)}`;
    faqs.push({
      question: `What grades does ${name} serve?`,
      answer: `${name} serves students in grades ${range}.`
    });
  }

  // 2. Tuition
  const dayMin = school.day_tuition || f(school, 'day_tuition_min');
  const dayMax = f(school, 'day_tuition_max');
  const boardMin = school.boarding_tuition || f(school, 'boarding_tuition_min');
  const boardMax = f(school, 'boarding_tuition_max');
  const aidPct = f(school, 'financial_aid_pct');
  const medianAid = f(school, 'median_aid_amount');
  if (dayMin || boardMin) {
    let text = '';
    if (dayMin) text += `Day tuition at ${name} is ${dayMax && dayMax !== dayMin ? `${sym}${dayMin.toLocaleString()}–${sym}${dayMax.toLocaleString()}` : `${sym}${dayMin.toLocaleString()}`}/year. `;
    if (boardMin) text += `Boarding tuition is ${boardMax && boardMax !== boardMin ? `${sym}${boardMin.toLocaleString()}–${sym}${boardMax.toLocaleString()}` : `${sym}${boardMin.toLocaleString()}`}/year. `;
    if (school.financial_aid_available) text += `Financial aid is available`;
    if (aidPct) text += `, with ${aidPct}% of students receiving assistance`;
    if (medianAid) text += ` (median package: ${sym}${medianAid.toLocaleString()})`;
    if (school.financial_aid_available) text += '. ';
    faqs.push({ question: `How much is tuition at ${name}?`, answer: text.trim() });
  }

  // 3. Application / Admissions
  const deadline = school.day_admission_deadline;
  const boardDeadline = f(school, 'boarding_admission_deadline');
  const appProcess = f(school, 'application_process') || [];
  const entranceReqs = school.admission_requirements || f(school, 'entrance_requirements') || [];
  if (deadline || boardDeadline || appProcess.length > 0 || entranceReqs.length > 0 || school.acceptance_rate) {
    let text = '';
    if (deadline) text += `The application deadline for day students is ${deadline}. `;
    if (boardDeadline) text += `Boarding application deadline is ${boardDeadline}. `;
    if (entranceReqs.length > 0) text += `Requirements include ${joinProse(entranceReqs)}. `;
    if (appProcess.length > 0) text += `The process involves: ${appProcess.join(', ')}. `;
    if (school.acceptance_rate) text += `The acceptance rate is ${school.acceptance_rate}%.`;
    faqs.push({ question: `How do I apply to ${name}?`, answer: text.trim() });
  }

  // 4. Curriculum
  if (school.curriculum || school.specializations?.length > 0 || school.teaching_philosophy) {
    let text = '';
    if (school.curriculum) text += `${name} offers ${Array.isArray(school.curriculum) ? joinProse(school.curriculum) : school.curriculum} curriculum. `;
    if (school.specializations?.length > 0) text += `The school specializes in ${joinProse(school.specializations)}. `;
    if (school.teaching_philosophy) text += school.teaching_philosophy;
    faqs.push({ question: `What curriculum does ${name} offer?`, answer: text.trim() });
  }

  // 5. Student-teacher ratio
  if (school.student_teacher_ratio || school.avg_class_size || school.enrollment) {
    let text = '';
    if (school.student_teacher_ratio) text += `The student-teacher ratio at ${name} is ${school.student_teacher_ratio}. `;
    if (school.avg_class_size) text += `Average class size is ${school.avg_class_size} students. `;
    if (school.enrollment) text += `Total enrollment is ${school.enrollment} students.`;
    faqs.push({ question: `What is the student-teacher ratio at ${name}?`, answer: text.trim() });
  }

  // 6. Boarding
  if (school.boarding_available !== undefined) {
    const boardingType = f(school, 'boarding_type');
    const boardingPct = f(school, 'boarding_pct');
    const living = f(school, 'living_arrangements') || [];
    if (school.boarding_available) {
      let text = `Yes, ${name} offers ${boardingType || 'boarding'}. `;
      if (boardingPct) text += `${boardingPct}% of students are boarders. `;
      if (living.length > 0) text += `Living arrangements include ${joinProse(living)}. `;
      if (boardMin) text += `Boarding tuition is ${sym}${boardMin.toLocaleString()}/year.`;
      faqs.push({ question: `Does ${name} offer boarding?`, answer: text.trim() });
    } else {
      faqs.push({ question: `Does ${name} offer boarding?`, answer: `No, ${name} is a day school only.` });
    }
  }

  // 7. Religious school
  if (school.faith_based) {
    let text = `Yes, ${name} is a ${school.faith_based} school. `;
    if (school.values?.length > 0) text += `The school's core values include ${joinProse(school.values)}.`;
    faqs.push({ question: `Is ${name} a religious school?`, answer: text.trim() });
  }

  // 8. Sports
  if (school.sports_programs?.length > 0) {
    faqs.push({
      question: `What sports does ${name} offer?`,
      answer: `${name} offers ${school.sports_programs.length} sports programs including ${joinProse(school.sports_programs)}.`
    });
  }

  // 9. Arts
  if (school.arts_programs?.length > 0) {
    faqs.push({
      question: `What arts programs does ${name} have?`,
      answer: `Arts programs at ${name} include ${joinProse(school.arts_programs)}.`
    });
  }

  // 10. Clubs
  if (school.clubs?.length > 0) {
    faqs.push({
      question: `What clubs are available at ${name}?`,
      answer: `Students at ${name} can join ${joinProse(school.clubs)}.`
    });
  }

  // 11. Financial aid
  if (school.financial_aid_available) {
    const scholarships = parseScholarships(f(school, 'scholarships_json'));
    const tuitionNotes = f(school, 'tuition_notes');
    let text = `Yes, ${name} offers financial aid. `;
    if (aidPct) text += `${aidPct}% of students receive assistance. `;
    if (medianAid) text += `The median aid package is ${sym}${medianAid.toLocaleString()}. `;
    if (scholarships.length > 0) text += `Scholarships available include ${scholarships.map(s => s.name || s.title).filter(Boolean).join(', ')}. `;
    if (tuitionNotes) text += tuitionNotes;
    faqs.push({ question: `Does ${name} offer financial aid?`, answer: text.trim() });
  }

  // 12. Facilities
  const facilities = f(school, 'facilities', 'facilities') || [];
  const campusSize = f(school, 'campusSize', 'campus_size');
  if (facilities.length > 0 || campusSize) {
    let text = '';
    if (campusSize) text += `${name} sits on a ${campusSize}-acre campus. `;
    if (facilities.length > 0) text += `Facilities include ${joinProse(facilities)}. `;
    if (school.virtual_tour_url) text += `A virtual tour is available on the school's profile.`;
    faqs.push({ question: `What are the facilities at ${name}?`, answer: text.trim() });
  }

  // 13. Learning support
  const specialEd = f(school, 'specialEdPrograms', 'special_ed_programs') || [];
  if (specialEd.length > 0) {
    faqs.push({
      question: `Does ${name} have learning support?`,
      answer: `Yes, ${name} offers learning support programs including ${joinProse(specialEd)}.`
    });
  }

  // 14. Languages
  const languages = f(school, 'languagesOfInstruction', 'languages_of_instruction') || school.languages || [];
  if (languages.length > 0) {
    faqs.push({
      question: `What languages are taught at ${name}?`,
      answer: `Classes at ${name} are taught in ${joinProse(languages)}.`
    });
  }

  // 15. University placements
  const placements = f(school, 'universityPlacements', 'university_placements') || [];
  if (placements.length > 0) {
    faqs.push({
      question: `Where do ${name} graduates go?`,
      answer: `Graduates of ${name} go on to attend ${joinProse(placements)}.`
    });
  }

  // 16. Accreditations
  if (school.accreditations?.length > 0) {
    let text = `${name} is accredited by ${joinProse(school.accreditations)}. `;
    if (school.awards?.length > 0) text += `The school has also received the following awards: ${joinProse(school.awards)}.`;
    faqs.push({ question: `Is ${name} accredited?`, answer: text.trim() });
  }

  // 17. Mission
  if (school.mission_statement) {
    let text = school.mission_statement;
    if (school.values?.length > 0) text += ` Core values include ${joinProse(school.values)}.`;
    faqs.push({ question: `What is ${name}'s mission?`, answer: text });
  }

  // 18. Uniform
  if (school.uniformRequired !== undefined && school.uniformRequired !== null) {
    faqs.push({
      question: `Does ${name} require uniforms?`,
      answer: school.uniformRequired ? `Yes, ${name} requires students to wear uniforms.` : `No, ${name} does not require uniforms.`
    });
  }

  // 19. Transportation
  const transport = f(school, 'transportationOptions', 'transportation_options') || [];
  if (transport.length > 0) {
    faqs.push({
      question: `How do I get to ${name}?`,
      answer: `Transportation options for ${name} include ${joinProse(transport)}.${school.address ? ` The school is located at ${school.address}, ${school.city}, ${school.provinceState}.` : ''}`
    });
  }

  // 20. Academic culture
  const acadCulture = f(school, 'academicCulture', 'academic_culture');
  const pace = f(school, 'pace', 'pace');
  const focus = f(school, 'focus', 'focus');
  const communityVibe = f(school, 'communityVibe', 'community_vibe');
  if (acadCulture || pace || focus || communityVibe) {
    let text = '';
    if (acadCulture) text += `The academic culture at ${name} is ${acadCulture}. `;
    if (pace) text += `The pace is ${pace}. `;
    if (focus) text += `The school focuses on ${focus}. `;
    if (communityVibe) text += communityVibe;
    faqs.push({ question: `What is the academic culture like at ${name}?`, answer: text.trim() });
  }

  // 21. Homework load
  const homework = f(school, 'homeworkByGrade', 'homework_by_grade');
  if (homework) {
    faqs.push({
      question: `What is the homework load at ${name}?`,
      answer: typeof homework === 'string' ? homework : `Homework expectations at ${name} vary by grade level.`
    });
  }

  // 22. Open house / events
  if (events && events.length > 0) {
    const nextEvent = events[0];
    faqs.push({
      question: `When is the next open house at ${name}?`,
      answer: `The next upcoming event at ${name} is "${nextEvent.title}" on ${formatDate(nextEvent.date)}.${nextEvent.registrationUrl ? ' Registration is available on the school profile.' : ''}`
    });
  }

  // 23. International students
  const intlPct = f(school, 'internationalStudentPct', 'international_student_pct');
  if (intlPct) {
    faqs.push({
      question: `Does ${name} accept international students?`,
      answer: `Yes, ${intlPct}% of students at ${name} are international students.${school.boardingAvailable ? ` Boarding is available for international students.` : ''}`
    });
  }

  // 24. What is the school known for?
  if (school.specializations?.length > 0 || school.awards?.length > 0 || placements.length > 0) {
    let text = `${name} is known for `;
    const parts = [];
    if (school.specializations?.length > 0) parts.push(`its specializations in ${joinProse(school.specializations)}`);
    if (school.awards?.length > 0) parts.push(`awards including ${joinProse(school.awards)}`);
    if (placements.length > 0) parts.push(`strong university placements at institutions like ${placements.slice(0, 3).join(', ')}`);
    text += joinProse(parts) + '.';
    faqs.push({ question: `What is ${name} known for?`, answer: text });
  }

  return faqs;
}


// --- SEO Head Manager ---

function useSchoolSEO(school, slug, faqs) {
  useEffect(() => {
    if (!school) return;

    const gradeRange = school.gradesServed || '';
    const city = school.city || '';
    const province = school.provinceState || '';
    const currency = getCurrencySymbol(school.currency);
    const schoolType = getSchoolTypeLabel(school);

    document.title = `${school.name} — ${city}, ${province} | Grades ${gradeRange}, Tuition & Reviews | NextSchool`;

    const descParts = [
      `${school.name} is a ${schoolType} ${school.genderPolicy || ''} school in ${city}, ${province} serving grades ${gradeRange}.`,
      school.dayTuition ? `Day tuition from ${currency}${school.dayTuition.toLocaleString()}.` : '',
      school.acceptanceRate ? `${school.acceptanceRate}% acceptance rate.` : '',
      school.enrollment ? `${school.enrollment} students.` : ''
    ].filter(Boolean).join(' ');

    setMeta('description', descParts.substring(0, 160));
    setMeta('robots', 'index, follow');

    const canonical = `https://nextschool.ca/schools/${slug || school.slug || school.id}`;
    setLink('canonical', canonical);

    setMetaProperty('og:title', `${school.name} — ${schoolType} School in ${city} | NextSchool`);
    setMetaProperty('og:description', descParts.substring(0, 200));
    setMetaProperty('og:image', school.headerPhotoUrl || school.logoUrl || '/logo.png');
    setMetaProperty('og:url', canonical);
    setMetaProperty('og:type', 'place');
    setMetaProperty('og:site_name', 'NextSchool');

    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', `${school.name} — ${city}, ${province}`);
    setMetaName('twitter:description', descParts.substring(0, 200));

    setJsonLd('school', buildSchoolSchema(school, canonical));
    setJsonLd('breadcrumb', buildBreadcrumbSchema(school, canonical));
    setJsonLd('faq', buildFAQPageSchema(faqs));

    return () => {
      ['school', 'breadcrumb', 'faq'].forEach(key => {
        const el = document.querySelector(`script[data-schema="${key}"]`);
        if (el) el.remove();
      });
    };
  }, [school, slug, faqs]);
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
        ...(school.dayTuition ? [{ '@type': 'Offer', name: 'Day Tuition', price: String(school.dayTuition), priceCurrency: school.currency || 'CAD' }] : []),
        ...(school.boardingTuition ? [{ '@type': 'Offer', name: 'Boarding Tuition', price: String(school.boardingTuition), priceCurrency: school.currency || 'CAD' }] : [])
      ]
    }
  };
}

function buildBreadcrumbSchema(school, url) {
  let pos = 1;
  const items = [
    { '@type': 'ListItem', position: pos++, name: 'NextSchool', item: 'https://nextschool.ca' },
    { '@type': 'ListItem', position: pos++, name: 'Schools', item: 'https://nextschool.ca/SchoolDirectory' }
  ];
  if (school.provinceState) items.push({ '@type': 'ListItem', position: pos++, name: school.provinceState, item: `https://nextschool.ca/SchoolDirectory?province=${encodeURIComponent(school.provinceState)}` });
  if (school.city) items.push({ '@type': 'ListItem', position: pos++, name: school.city, item: `https://nextschool.ca/SchoolDirectory?city=${encodeURIComponent(school.city)}` });
  items.push({ '@type': 'ListItem', position: pos++, name: school.name, item: url });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function buildFAQPageSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer }
    }))
  };
}


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SchoolProfile() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug;

  const legacyId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;
  const schoolId = slug ? null : legacyId;

  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [relatedSchools, setRelatedSchools] = useState([]);
  const [sessionId] = useState(() => crypto.randomUUID());

  // Load school by slug or ID
  useEffect(() => {
    const loadSchool = async () => {
      setLoading(true);
      try {
        let schools;
        if (slug) {
          schools = await SchoolEntity.filter({ slug });
        } else if (schoolId) {
          schools = await SchoolEntity.filter({ id: schoolId });
        }
        if (schools && schools.length > 0) {
          const s = schools[0];
          setSchool(s);
          if (!slug && s.slug) {
            router.replace(`/schools/${s.slug}`);
          }
        }
      } catch (error) {
        console.error('Failed to load school:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchool();
  }, [slug, schoolId]);

  // Track page view
  useEffect(() => {
    if (!school) return;
    invokeFunction('trackSessionEvent', {
      eventType: 'page_view',
      sessionId,
      metadata: { page: 'SchoolProfile', schoolId: school.id }
    }).catch(() => {});
  }, [school, sessionId]);

  // Load testimonials
  useEffect(() => {
    if (!school?.id) return;
    Testimonial.filter({ schoolId: school.id, is_visible: true })
      .then(setTestimonials)
      .catch(() => {});
  }, [school?.id]);

  // Load upcoming events
  useEffect(() => {
    if (!school?.id) return;
    setLoadingEvents(true);
    const now = new Date().toISOString();
    SchoolEvent.filter({ schoolId: school.id, isActive: true, date: { $gte: now } })
      .then(events => {
        const sorted = (events || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        setUpcomingEvents(sorted.slice(0, 5));
      })
      .catch(() => setUpcomingEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [school?.id]);

  // Load related schools
  useEffect(() => {
    if (!school?.city) return;
    SchoolEntity.filter({ city: school.city })
      .then(schools => setRelatedSchools((schools || []).filter(s => s.id !== school.id).slice(0, 4)))
      .catch(() => {});
  }, [school?.city, school?.id]);

  // --- Derived values ---
  const currency = school?.currency || 'CAD';
  const sym = getCurrencySymbol(currency);
  const lowestGradeL = school?.lowestGrade != null ? gradeLabel(school.lowestGrade) : null;
  const highestGradeL = school?.highestGrade != null ? gradeLabel(school.highestGrade) : null;
  const computedGradeRange = lowestGradeL && highestGradeL ? `${lowestGradeL} – ${highestGradeL}` : (school?.gradesServed || '');

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

  // Generate dynamic FAQs
  const dynamicFAQs = useMemo(() => {
    if (!school) return [];
    return generateSchoolFAQs(school, upcomingEvents);
  }, [school, upcomingEvents]);

  // SEO hooks
  useSchoolSEO(school, slug, dynamicFAQs);

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
          <Link href="/consultant">
            <Button>Find Your Perfect School</Button>
          </Link>
        </div>
      </div>
    );
  }

  const schoolTypeLabel = getSchoolTypeLabel(school);
  const websiteUrl = school.website ? (school.website.startsWith('http') ? school.website : `https://${school.website}`) : null;
  const consultantUrl = `/consultant?school=${encodeURIComponent(school.slug || school.id)}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />

      {/* ============================================================ */}
      {/* 1. BREADCRUMBS                                               */}
      {/* ============================================================ */}
      <nav aria-label="Breadcrumb" className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <li><Link href="/" className="hover:text-teal-600">NextSchool</Link></li>
            <li><ChevronRight className="h-3 w-3" /></li>
            <li><Link href="/schools" className="hover:text-teal-600">Schools</Link></li>
            {school.provinceState && (
              <>
                <li><ChevronRight className="h-3 w-3" /></li>
                <li><Link href={`/SchoolDirectory?province=${encodeURIComponent(school.provinceState)}`} className="hover:text-teal-600">{school.provinceState}</Link></li>
              </>
            )}
            {school.city && (
              <>
                <li><ChevronRight className="h-3 w-3" /></li>
                <li><Link href={`/SchoolDirectory?city=${encodeURIComponent(school.city)}`} className="hover:text-teal-600">{school.city}</Link></li>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              {school.logoUrl && (
                <img src={school.logoUrl} alt={`${school.name} logo`}
                  className="h-10 sm:h-14 w-10 sm:w-14 rounded-lg bg-white p-1 sm:p-2 shadow-lg object-contain" loading="eager" />
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                {school.name} — {schoolTypeLabel.charAt(0).toUpperCase() + schoolTypeLabel.slice(1)} School in {school.city}, {school.provinceState}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-white/90 mb-4">
              {schoolTypeLabel.charAt(0).toUpperCase() + schoolTypeLabel.slice(1)} · {school.genderPolicy || 'Co-ed'} · Grades {computedGradeRange}
              {school.faithBased ? ` · ${school.faithBased}` : ''}
              {school.founded ? ` · Est. ${school.founded}` : ''}
            </p>
            <Link href={consultantUrl}>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg">
                <MessageCircle className="h-4 w-4 mr-2" />
                Get Expert Guidance on {school.name}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. QUICK FACTS BAR                                           */}
      {/* ============================================================ */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <dl className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {computedGradeRange && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Grades</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{computedGradeRange}</dd></div>
            )}
            <div><dt className="text-xs sm:text-sm text-slate-500">Enrollment</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.enrollment ? `${school.enrollment.toLocaleString()} students` : 'N/A'}</dd></div>
            <div><dt className="text-xs sm:text-sm text-slate-500">Day Tuition</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{dayTuitionMin ? `${sym}${dayTuitionMin.toLocaleString()}/yr` : 'N/A'}</dd></div>
            {school.avgClassSize && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Class Size</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.avgClassSize} students</dd></div>
            )}
            {school.studentTeacherRatio && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Student-Teacher Ratio</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.studentTeacherRatio}</dd></div>
            )}
            {school.acceptanceRate && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Acceptance Rate</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.acceptanceRate}%</dd></div>
            )}
            {school.founded && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Founded</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.founded}</dd></div>
            )}
            {campusSize && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Campus</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{campusSize} acres</dd></div>
            )}
            {internationalPct && (
              <div><dt className="text-xs sm:text-sm text-slate-500">International Students</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{internationalPct}%</dd></div>
            )}
            {school.genderPolicy && (
              <div><dt className="text-xs sm:text-sm text-slate-500">Gender Policy</dt><dd className="text-base sm:text-xl font-bold text-slate-900">{school.genderPolicy}</dd></div>
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

            {/* ======== 4. INLINE CTA #1 ======== */}
            <ConsultantCTA school={school} text={`Not sure if ${school.name} is right for your child? Talk to a consultant for personalized guidance.`} />

            {/* ======== 5. ABOUT ======== */}
            {(school.description || school.missionStatement || school.teachingPhilosophy || school.values?.length > 0) && (
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
                  <p className="text-slate-700 mb-3"><strong>Core Values:</strong> {joinProse(school.values)}</p>
                )}

                {school.teachingPhilosophy && (
                  <p className="text-slate-700"><strong>Teaching Philosophy:</strong> {school.teachingPhilosophy}</p>
                )}

                {school.faithBased && (
                  <p className="text-slate-700 mt-3"><strong>Faith Tradition:</strong> {school.faithBased}</p>
                )}
              </article>
            )}

            {/* ======== Highlights ======== */}
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

            {/* ======== 6. ACADEMICS & CURRICULUM ======== */}
            {(school.curriculum || academicCulture || pace || focus || specialEdPrograms.length > 0 || languagesOfInstruction.length > 0 || mathApproach || scienceApproach || homeworkByGrade) && (
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

            {/* ======== 7. INLINE CTA #2 ======== */}
            {school.curriculum && (
              <ConsultantCTA school={school} text={`Wondering if ${Array.isArray(school.curriculum) ? joinProse(school.curriculum) : school.curriculum} is the right fit for your child?`} />
            )}

            {/* ======== 8. PROGRAMS & EXTRACURRICULARS ======== */}
            {(school.artsPrograms?.length > 0 || school.sportsPrograms?.length > 0 || school.clubs?.length > 0) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Programs & Extracurriculars at {school.name}</h2>

                {school.artsPrograms?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Arts Programs</h3>
                    <p className="text-slate-700 mb-2">{school.name} offers {school.artsPrograms.length} arts programs including {joinProse(school.artsPrograms)}.</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {school.artsPrograms.map((p, i) => <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">{p}</span>)}
                    </div>
                  </>
                )}

                {school.sportsPrograms?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Sports</h3>
                    <p className="text-slate-700 mb-2">Athletic programs include {joinProse(school.sportsPrograms)}.</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {school.sportsPrograms.map((p, i) => <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{p}</span>)}
                    </div>
                  </>
                )}

                {school.clubs?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Clubs & Activities</h3>
                    <p className="text-slate-700 mb-2">Students can join {joinProse(school.clubs)}.</p>
                    <div className="flex flex-wrap gap-2">
                      {school.clubs.map((c, i) => <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">{c}</span>)}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ======== 9. CAMPUS & FACILITIES ======== */}
            {(campusSize || facilities.length > 0 || school.boardingAvailable || transportationOptions.length > 0 || school.photoGallery?.length > 0 || school.virtualTourUrl || livingArrangements.length > 0) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Campus & Facilities</h2>

                {(campusSize || facilities.length > 0) && (
                  <p className="text-slate-700 mb-4">
                    {school.name}{campusSize ? ` sits on a ${campusSize}-acre campus` : ' features a campus'}
                    {facilities.length > 0 ? ` with ${joinProse(facilities)}.` : '.'}
                  </p>
                )}

                {school.uniformRequired !== undefined && school.uniformRequired !== null && (
                  <p className="text-slate-700 mb-4">
                    <strong>Uniform:</strong> {school.uniformRequired ? 'Required' : 'Not required'}
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
                        <img key={index} src={photo} alt={`${school.name} campus photo ${index + 1}`}
                          className="rounded-lg w-full h-32 sm:h-40 object-cover" loading="lazy" />
                      ))}
                    </div>
                  </>
                )}

                {school.virtualTourUrl && (
                  <a href={school.virtualTourUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium">
                    <Eye className="h-4 w-4" /> Take a virtual tour of {school.name} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </section>
            )}

            {/* ======== 10. TUITION & FINANCIAL AID ======== */}
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
                      <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Financial Aid</dt><dd className="text-sm font-medium text-slate-800">{school.financialAidAvailable ? 'Available' : 'Not available'}</dd></div>
                    )}
                    {financialAidPct && (
                      <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Students Receiving Aid</dt><dd className="text-sm font-medium text-slate-800">{financialAidPct}%</dd></div>
                    )}
                    {medianAidAmount && (
                      <div className="bg-slate-50 rounded-lg p-3"><dt className="text-xs text-slate-500 mb-1">Median Aid Package</dt><dd className="text-sm font-medium text-slate-800">{sym}{medianAidAmount.toLocaleString()}</dd></div>
                    )}
                  </dl>
                )}

                {tuitionNotes && <p className="text-sm text-slate-500 italic mb-4">{tuitionNotes}</p>}

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

            {/* ======== 11. INLINE CTA #3 ======== */}
            {(dayTuitionMin || school.financialAidAvailable) && (
              <ConsultantCTA school={school} text="Want help understanding the true cost? Get a personalized breakdown from a consultant." />
            )}

            {/* ======== 12. ADMISSIONS ======== */}
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
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded"><CheckCircle2 className="h-3 w-3" /> Confirmed</span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> Listed on website</span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 mb-1">{event.title}</p>
                          <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatEventDate(event.date)}
                          </p>
                          {event.description && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{event.description}</p>}
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

            {/* ======== 13. OUTCOMES ======== */}
            {universityPlacements.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">University Placements & Outcomes</h2>
                <p className="text-slate-700">Graduates of {school.name} go on to attend {joinProse(universityPlacements)}.</p>
              </section>
            )}

            {/* ======== 14. COMMUNITY & CULTURE ======== */}
            {communityVibe && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Community & Culture at {school.name}</h2>
                <p className="text-slate-700">{communityVibe}</p>
              </section>
            )}

            {/* ======== 15. TESTIMONIALS ======== */}
            {testimonials.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">What Parents & Students Say About {school.name}</h2>
                <p className="text-xs text-slate-500 mb-4">Provided by {school.name}</p>
                <div className="space-y-4">
                  {testimonials.map(t => (
                    <blockquote key={t.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100"
                      itemScope itemType="https://schema.org/Review">
                      <p className="text-slate-700 leading-relaxed italic mb-3" itemProp="reviewBody">
                        &ldquo;{t.quote_text}&rdquo;
                      </p>
                      <cite className="flex items-center gap-2 text-sm text-slate-500 not-italic">
                        <span className="font-medium text-slate-700" itemProp="author">{t.author_first_name}</span>
                        <span>&middot;</span>
                        <span className="capitalize">{t.author_role}</span>
                        {t.year_submitted && <><span>&middot;</span><span>{t.year_submitted}</span></>}
                      </cite>
                    </blockquote>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Have experience with {school.name}?{' '}
                  <Link href={consultantUrl} className="text-teal-600 hover:underline font-medium">Share your thoughts with a consultant</Link>
                </p>
              </section>
            )}

            {/* ======== 16. ACCREDITATIONS & AWARDS ======== */}
            {((school.accreditations && school.accreditations.length > 0) || (school.awards && school.awards.length > 0)) && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Accreditations & Recognition</h2>
                {school.accreditations && school.accreditations.length > 0 && (
                  <p className="text-slate-700 mb-3">{school.name} is accredited by {joinProse(school.accreditations)}.</p>
                )}
                {school.awards && school.awards.length > 0 && (
                  <p className="text-slate-700">Awards: {joinProse(school.awards)}</p>
                )}
              </section>
            )}

            {/* ======== 17. CONTACT & LOCATION ======== */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Contact {school.name}</h2>
              <address className="not-italic text-slate-700 space-y-2">
                {school.address && <p>{school.address}, {school.city}, {school.provinceState}{school.country ? `, ${school.country}` : ''}</p>}
                {!school.address && school.city && <p>{school.city}, {school.provinceState}{school.country ? `, ${school.country}` : ''}</p>}
                {school.phone && <p>Phone: <a href={`tel:${school.phone}`} className="text-teal-600 hover:underline">{school.phone}</a></p>}
                {school.email && <p>Email: <a href={`mailto:${school.email}`} className="text-teal-600 hover:underline">{school.email}</a></p>}
                {websiteUrl && (
                  <p><a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-600 hover:underline">Visit School Website <ExternalLink className="h-3 w-3" /></a></p>
                )}
              </address>
            </section>

            {/* ======== 18. FAQ — up to 20+ dynamic FAQs ======== */}
            {dynamicFAQs.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8" itemScope itemType="https://schema.org/FAQPage">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Frequently Asked Questions about {school.name}</h2>
                {dynamicFAQs.map((faq, idx) => (
                  <div key={idx} className="mb-4" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                    <h3 className="font-semibold text-slate-800 mb-1" itemProp="name">{faq.question}</h3>
                    <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                      <p className="text-slate-700" itemProp="text">{faq.answer}</p>
                    </div>
                  </div>
                ))}
                <p className="mt-4 text-sm text-slate-600">
                  Still have questions?{' '}
                  <Link href={consultantUrl} className="text-teal-600 hover:underline font-medium">Our AI consultants have answers</Link>
                </p>
              </section>
            )}

            {/* ======== 19. RELATED SCHOOLS ======== */}
            {relatedSchools.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Similar Schools Near {school.city}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedSchools.map(rs => (
                    <Link key={rs.id} href={rs.slug ? `/schools/${rs.slug}` : `/school?id=${rs.id}`}
                      className="block bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-teal-300 hover:shadow-sm transition-all">
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
                <p className="mt-4 text-sm text-slate-600">
                  <Link href={consultantUrl} className="text-teal-600 hover:underline font-medium">Compare schools in {school.city}</Link>
                </p>
              </section>
            )}

          </div>

          {/* --- RIGHT: SIDEBAR --- */}
          <aside className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 lg:sticky lg:top-24">
              {/* Primary CTA: Chat */}
              <Link href={consultantUrl} className="block w-full mb-4">
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-sm sm:text-base">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Get Expert Guidance
                </Button>
              </Link>

              {/* Contact Info (read-only) */}
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

              {/* Accreditations */}
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

              {/* Compare schools link */}
              <div className="mt-6 pt-6 border-t">
                <Link href={consultantUrl} className="text-sm text-teal-600 hover:underline font-medium">
                  Compare schools in {school.city}
                </Link>
              </div>
            </div>
          </aside>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 20. LAST UPDATED FOOTER                                      */}
      {/* ============================================================ */}
      <footer className="bg-slate-100 border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500">
          {(school.updatedAt || school.updated_at) && (
            <p className="mb-2">
              Information last updated {formatDate(school.updatedAt || school.updated_at)}.
              Data sourced from school records and public information.
            </p>
          )}
          <p className="flex flex-wrap gap-2">
            <Link href="/schools" className="text-teal-600 hover:underline">Browse all private schools</Link>
            <span>&middot;</span>
            {school.provinceState && (
              <>
                <Link href={`/SchoolDirectory?province=${encodeURIComponent(school.provinceState)}`} className="text-teal-600 hover:underline">Schools in {school.provinceState}</Link>
                <span>&middot;</span>
              </>
            )}
            {school.city && (
              <>
                <Link href={`/SchoolDirectory?city=${encodeURIComponent(school.city)}`} className="text-teal-600 hover:underline">Schools in {school.city}</Link>
                <span>&middot;</span>
              </>
            )}
            <Link href="/consultant" className="text-teal-600 hover:underline">Find your perfect school match</Link>
          </p>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* 21. STICKY BOTTOM CTA                                        */}
      {/* ============================================================ */}
      <ConsultantCTA school={school} variant="sticky" />
    </div>
  );
}

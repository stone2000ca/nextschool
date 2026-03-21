import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X, Star } from "lucide-react";
import Link from 'next/link';
import Navbar from "@/components/navigation/Navbar";
import { invokeFunction } from '@/lib/functions';
import { LOGO_BLACK_TEXT } from '@/lib/brand-assets';
import { fetchSchools } from '@/lib/api/schools';
import SchoolCardUnified from '@/components/schools/SchoolCardUnified';
import Footer from '@/components/navigation/Footer';

export default function Home() {
  const router = useRouter();
  const [heroQuery, setHeroQuery] = useState('');
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    // Track page view
    invokeFunction('trackSessionEvent', {
      eventType: 'page_view',
      sessionId,
      metadata: { page: 'Home' }
    }).catch(err => console.error('Failed to track:', err));

    // Set meta tags for SEO
    document.title = 'NextSchool - Find the Perfect Private School for Your Child';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'AI-powered education consultant helping Canadian parents find, compare, and choose the right private school. Chat with Jackie or Liam to start your search.';

    // OG Tags
    const ogTags = {
      'og:title': 'NextSchool - Find the Perfect Private School for Your Child',
      'og:description': 'AI-powered education consultant helping Canadian parents find, compare, and choose the right private school. Chat with Jackie or Liam to start your search.',
      'og:image': LOGO_BLACK_TEXT,
      'og:url': 'https://nextschool.ca/Home',
      'og:type': 'website',
      'og:site_name': 'NextSchool'
    };

    for (const [property, content] of Object.entries(ogTags)) {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    }

    // Structured Data for Website
    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'NextSchool',
      url: 'https://nextschool.ca',
      description: 'AI-powered education consultant helping families find the perfect private school',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://nextschool.ca/Consultant?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    };

    let schemaScript = document.querySelector('script[data-schema="home"]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.setAttribute('data-schema', 'home');
      document.head.appendChild(schemaScript);
    }
    schemaScript.innerHTML = JSON.stringify(schemaData);

    loadFeaturedSchools();
  }, []);

  const loadFeaturedSchools = async () => {
    try {
      const featuredNames = ["Havergal College", "Upper Canada College", "Branksome Hall", "Crescent School"];
      const data = await fetchSchools({ names: featuredNames });
      setSchools(data.slice(0, 4));
    } catch (error) {
      console.error('Failed to load featured schools:', error);
    } finally {
      setLoadingSchools(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Canonical URL */}
      <link rel="canonical" href="https://nextschool.ca/Home" />
      
      {/* TASK E: Skip navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>
      
      <Navbar transparent />

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="https://fofygizrrcxdsijzfxab.supabase.co/storage/v1/object/public/video/hero_video_nextschool.mp4"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

        <div id="main-content" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="ns-display !text-white text-3xl sm:text-5xl lg:text-6xl mb-4 sm:mb-6 leading-tight">
            Find a school your child will{' '}
            <em className="text-teal-400 not-italic">love</em>
          </h1>
          <p className="text-lg sm:text-xl text-white/80 mb-8 sm:mb-10 max-w-3xl mx-auto font-light">
            Chat with an AI consultant that narrows 1,000+ Canadian private schools down to the few that truly fit your child.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = heroQuery.trim();
              router.push(trimmed ? `/consultant?q=${encodeURIComponent(trimmed)}` : '/consultant');
            }}
            className="max-w-4xl mx-auto mb-4"
          >
            <div className="flex gap-3">
              <input
                type="text"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="Tell us about your child and what you're looking for..."
                className="flex-1 bg-white/10 border border-white/30 text-white placeholder:text-white/50 rounded-full px-8 py-5 text-lg sm:text-xl focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400 backdrop-blur-sm"
              />
              <button
                type="submit"
                className="h-16 w-16 flex-shrink-0 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-colors animate-pulse"
                aria-label="Start conversation with AI consultant"
              >
                <ArrowRight className="h-7 w-7" />
              </button>
            </div>
          </form>


          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-teal-400 flex-shrink-0" />
              Free to start
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-teal-400 flex-shrink-0" />
              1,000+ Canadian schools
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-teal-400 flex-shrink-0" />
              Private &amp; secure
            </span>
          </div>
        </div>
      </section>

      {/* YOUR JOURNEY (WC-3) */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="text-center mb-12 sm:mb-16">
            <p className="ns-label mb-3">YOUR JOURNEY</p>
            <h2 className="ns-heading text-3xl sm:text-4xl mb-3">
              From first question to <strong className="text-teal-600">confident decision</strong>
            </h2>
            <p className="text-slate-600 text-lg">Three steps. One evening. Zero overwhelm.</p>
          </div>

          {/* 3 steps */}
          <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
            {[
              { step: 1, title: 'Tell us about your child', output: 'Your Family Brief updates with every interaction' },
              { step: 2, title: 'Get personalized matches', output: 'We\u2019ll match your preferences against over 80 school criteria' },
              { step: 3, title: 'Decide with confidence', output: 'We\u2019ll support you every step of the way' },
            ].map((item, i) => (
              <div key={item.step} className="flex flex-col items-center text-center relative">
                {/* Arrow connector (desktop only, between steps) */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-5 -right-2 translate-x-1/2 text-slate-300">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}

                {/* Numbered badge */}
                <div className="bg-teal-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold mb-4">
                  {item.step}
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>

                {/* Output tag */}
                <p className="text-sm text-teal-600 font-medium bg-teal-50 rounded-full px-4 py-1.5">
                  {item.output}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link href="/consultant" className="ns-btn-primary inline-flex items-center">
              Find the right school
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* DIY vs NEXTSCHOOL COMPARISON */}
      <section className="py-12 sm:py-20 lg:py-28 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Stop Googling. Start <span className="text-teal-400">matching.</span>
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              See why families switch from DIY research to NextSchool.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* DIY Search Column */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-red-400 mb-6">DIY Search</h3>
              <div className="space-y-5">
                <div className="flex gap-3">
                  <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">27 open tabs</p>
                    <p className="text-slate-400 text-sm">Juggling school websites, forums, and outdated blog posts with no way to organize what you find.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Can't compare apples to apples</p>
                    <p className="text-slate-400 text-sm">Every school presents information differently, making it impossible to evaluate them side by side.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Weeks of research</p>
                    <p className="text-slate-400 text-sm">Evenings and weekends spent reading, only to feel like you're going in circles.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Decision overwhelm</p>
                    <p className="text-slate-400 text-sm">Too many options and too little clarity leave you second-guessing every choice.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* NextSchool Column */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-green-400 mb-6">NextSchool</h3>
              <div className="space-y-5">
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">One guided conversation</p>
                    <p className="text-slate-400 text-sm">Tell us about your child and family priorities — our AI consultant handles the research for you.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Fit scores you can trust</p>
                    <p className="text-slate-400 text-sm">Every recommendation comes with a clear explanation of why it matches your family's needs.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Shortlist in one evening</p>
                    <p className="text-slate-400 text-sm">Go from "where do I start?" to a focused shortlist in a single conversation.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Calm and supported</p>
                    <p className="text-slate-400 text-sm">No pressure, no sales pitch — just clear guidance to help you make the right decision.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10 sm:mt-12">
            <Link href="/consultant" className="ns-btn-primary inline-flex items-center">
              Start your free chat <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED SCHOOLS */}
      <section className="py-12 sm:py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 gap-4">
            <h2 className="ns-heading text-3xl sm:text-4xl">Featured Schools</h2>
            <Link
              href="/schools"
              className="text-teal-600 hover:text-teal-700 text-sm font-semibold inline-flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 rounded"
              aria-label="Browse all schools in directory"
            >
              Browse all schools <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingSchools ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 h-64 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-6" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {schools.map((school) => (
                <Link 
                  key={school.id} 
                  href={`/school?id=${school.id}`}
                  className="block focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 rounded-lg"
                >
                  <SchoolCardUnified school={school} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-12 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Real families, real decisions
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
              See how Canadian parents found the right school for their child.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Sarah M. */}
            <div className="ns-card p-6">
              <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Relocating Family
              </span>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                "We were moving from Calgary to Toronto with two weeks to figure out schools. NextSchool narrowed 200+ options to five that genuinely fit our kids — in one evening."
              </p>
              <p className="text-teal-600 text-sm font-semibold mb-4">
                Enrolled both children within three weeks of moving.
              </p>
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                  SM
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Sarah M.</p>
                  <p className="text-slate-500 text-xs">Toronto, ON</p>
                </div>
              </div>
            </div>

            {/* David L. */}
            <div className="ns-card p-6">
              <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                First-Time Parent
              </span>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                "As a first-time parent, I had no idea where to start. The consultant asked the right questions and helped me understand what actually matters for my daughter's learning style."
              </p>
              <p className="text-teal-600 text-sm font-semibold mb-4">
                Found a Montessori program that matched their family values perfectly.
              </p>
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                  DL
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">David L.</p>
                  <p className="text-slate-500 text-xs">Vancouver, BC</p>
                </div>
              </div>
            </div>

            {/* Priya K. */}
            <div className="ns-card p-6">
              <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                ADHD Support
              </span>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                "My son has ADHD and I needed a school that truly understands neurodivergent learners — not just one that says they do. NextSchool helped me find schools with real support programs."
              </p>
              <p className="text-teal-600 text-sm font-semibold mb-4">
                Son thriving at a school with dedicated learning support specialists.
              </p>
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                  PK
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Priya K.</p>
                  <p className="text-slate-500 text-xs">Ottawa, ON</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-400 italic mt-8">
            Illustrative examples based on common family experiences
          </p>
        </div>
      </section>

      {/* FOR SCHOOLS CTA */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Are you a school?
          </h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto">
            Claim your free profile and control how families discover you.
          </p>
          <Link href="/for-schools">
            <button className="ns-btn-primary">
              Learn More <ArrowRight className="ml-2 h-4 w-4 inline" />
            </button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
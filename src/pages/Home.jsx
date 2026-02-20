import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Zap, BarChart3, CheckCircle2 } from "lucide-react";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";
import { base44 } from '@/api/base44Client';

export default function Home() {
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    loadFeaturedSchools();
  }, []);

  const loadFeaturedSchools = async () => {
    try {
      const data = await base44.entities.School.list('-updated_date', 6);
      setSchools(data);
    } catch (error) {
      console.error('Failed to load featured schools:', error);
    } finally {
      setLoadingSchools(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Find the Private School Where Your Child Will Thrive
          </h1>
          <p className="text-xl sm:text-2xl text-slate-200 mb-10 max-w-3xl mx-auto font-light">
            Our AI education consultant evaluates schools across Canada, the US, and the UK to find the ones that truly fit your family's needs.
          </p>
          <Link to={createPageUrl('Consultant')}>
            <Button size="lg" className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-7 text-lg">
              Meet Your Consultant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CHOOSE YOUR CONSULTANT */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-6 text-slate-900">Two Consultant Styles, One Goal</h2>
          <p className="text-xl text-slate-600 text-center max-w-3xl mx-auto mb-16">Choose the consultant approach that fits your family's needs — and switch anytime you'd like.</p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 p-8 rounded-2xl">
              <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-2xl mb-6 overflow-hidden mx-auto">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699717aa28903550c09d4d26/150ea2350_Jackie.jpg" alt="Jackie" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">Jackie</h3>
              <p className="text-sm text-rose-700 font-semibold mb-4">Warm & Supportive</p>
              <p className="text-slate-700 mb-6">Jackie brings empathy and emotional intelligence to your school search. She validates your concerns, celebrates your child's strengths, and makes sure your family truly feels heard.</p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>✓ Emotionally attuned & understanding</li>
                <li>✓ Thoughtful & thorough conversations</li>
                <li>✓ Celebrates strengths & personalities</li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-8 rounded-2xl">
              <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl mb-6 overflow-hidden mx-auto">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699717aa28903550c09d4d26/b1163e434_Liam.png" alt="Liam" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">Liam</h3>
              <p className="text-sm text-blue-700 font-semibold mb-4">Direct & Strategic</p>
              <p className="text-slate-700 mb-6">Liam cuts straight to the analysis. He matches your priorities with school data, gets you fast results, and focuses on the strategic metrics that matter to your family's goals.</p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>✓ Data-driven & strategic</li>
                <li>✓ Efficient & focused conversations</li>
                <li>✓ Clear analysis & recommendations</li>
              </ul>
            </div>
          </div>
          
          <div className="text-center">
            <Link to={createPageUrl('Consultant')}>
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6">
                Choose Your Consultant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-slate-900">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="h-14 w-14 bg-teal-100 rounded-lg flex items-center justify-center mb-6">
                <MessageSquare className="h-7 w-7 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Tell Us About Your Child</h3>
              <p className="text-slate-600 leading-relaxed">
                Share your child's needs, interests, and your family's priorities through a natural conversation.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="h-14 w-14 bg-amber-100 rounded-lg flex items-center justify-center mb-6">
                <Zap className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Get Personalized Matches</h3>
              <p className="text-slate-600 leading-relaxed">
                Our AI consultant cross-references your needs with detailed school data to find real fits — not generic lists.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="h-14 w-14 bg-teal-100 rounded-lg flex items-center justify-center mb-6">
                <BarChart3 className="h-7 w-7 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Compare, Shortlist & Decide</h3>
              <p className="text-slate-600 leading-relaxed">
                See why each school made the list, compare side-by-side, and build your shortlist with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / TRUST SIGNALS */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mb-4">
                <p className="text-5xl font-bold text-teal-600 mb-2">283+</p>
                <p className="text-xl text-slate-700 font-semibold">Schools</p>
              </div>
              <p className="text-slate-600">Verified school profiles across Canada</p>
            </div>
            
            <div className="text-center">
              <div className="mb-4">
                <CheckCircle2 className="h-16 w-16 text-amber-500 mx-auto mb-2" />
                <p className="text-xl text-slate-700 font-semibold">Personalized Matches</p>
              </div>
              <p className="text-slate-600">Every recommendation explains why it fits your family</p>
            </div>
            
            <div className="text-center">
              <div className="mb-4">
                <p className="text-5xl font-bold text-teal-600 mb-2">Free</p>
                <p className="text-xl text-slate-700 font-semibold">To Start</p>
              </div>
              <p className="text-slate-600">Full consultation with no signup required</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED SCHOOLS */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900">Featured Schools</h2>
            <Link to={createPageUrl('SchoolDirectory')}>
              <Button variant="outline" className="text-teal-600 border-teal-600 hover:bg-teal-50">
                Browse All Schools <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingSchools ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schools.map((school) => (
                <Link key={school.id} to={`${createPageUrl('SchoolProfile')}?schoolId=${school.id}`}>
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-teal-200 transition-all h-full">
                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{school.name}</h3>
                    <p className="text-sm text-slate-600 mb-4">{school.city}, {school.provinceState}</p>
                    
                    <div className="space-y-3">
                      {school.gradesServed && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Grades:</span>
                          <span className="font-semibold text-slate-900">{school.gradesServed}</span>
                        </div>
                      )}
                      {school.tuition && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Tuition:</span>
                          <span className="font-semibold text-slate-900">${school.tuition?.toLocaleString()}</span>
                        </div>
                      )}
                      {school.curriculumType && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Curriculum:</span>
                          <span className="font-semibold text-slate-900">{school.curriculumType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOR SCHOOLS CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-r from-teal-50 to-amber-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Are You a School Administrator?
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Claim your free profile on NextSchool. Control how families discover your school.
          </p>
          <Link to={`${createPageUrl('ClaimSchool')}?schoolId=`}>
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-7 text-lg">
              Claim Your School
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
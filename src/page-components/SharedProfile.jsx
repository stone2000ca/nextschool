import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { User } from '@/lib/entities';
import { fetchSchools } from '@/lib/api/schools';
import { fetchSharedProfile } from '@/lib/api/sessions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, MapPin, DollarSign, Bookmark } from 'lucide-react';
import Navbar from '@/components/navigation/Navbar';
import SchoolCard from '@/components/schools/SchoolCard';

export default function SharedProfile() {
  const searchParams = useSearchParams();
  const shareToken = searchParams.get('token');
  const [session, setSession] = useState(null);
  const [schools, setSchools] = useState([]);
  const [shortlistedSchools, setShortlistedSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadSharedProfile();
  }, [shareToken]);

  const loadSharedProfile = async () => {
    try {
      // Fetch ChatSession by shareToken via API
      let chatSession;
      try {
        chatSession = await fetchSharedProfile(shareToken);
      } catch (e) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSession(chatSession);

      // Load matched schools
      if (chatSession.matched_schools) {
        try {
          const matchedIds = JSON.parse(chatSession.matched_schools);
          const matchedSchoolIds = Array.isArray(matchedIds) ? matchedIds : [];
          
          if (matchedSchoolIds.length > 0) {
            const schoolData = await fetchSchools({
              ids: matchedSchoolIds.slice(0, 5)
            });
            setSchools(schoolData);
          }
        } catch (e) {
          console.error('Failed to parse matched schools:', e);
        }
      }

      // Load shortlisted schools if any
      if (chatSession.user_id) {
        try {
          const user = await User.filter({
            id: chatSession.user_id
          });
          if (user.length > 0 && user[0].shortlist) {
            const shortlistedData = await fetchSchools({
              ids: user[0].shortlist
            });
            setShortlistedSchools(shortlistedData);
          }
        } catch (e) {
          console.error('Failed to load shortlisted schools:', e);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load shared profile:', error);
      setNotFound(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1E1E2E] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-[#1E1E2E]">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold text-white mb-3">Profile Not Found</h1>
            <p className="text-[#E8E8ED]/70 mb-6">This shared profile link is invalid or has been removed.</p>
            <Link href={'/consultant'}>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                Start Your Own Search <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E1E2E]">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-[#2A2A3D] to-[#1F1F2E] rounded-2xl p-8 border border-white/10 mb-12">
          {/* Child Info */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center font-bold text-white text-2xl flex-shrink-0">
                {session.child_name ? session.child_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">
                  {session.child_name || 'Student Profile'}
                </h1>
                {session.child_grade != null && (
                  <p className="text-lg text-[#E8E8ED]/70">Grade {session.child_grade}</p>
                )}
              </div>
            </div>

            {/* Key Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {session.location_area && (
                <div className="flex items-start gap-3 p-3 bg-[#2A2A3D] rounded-lg border border-white/10">
                  <MapPin className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[#E8E8ED]/60">Location</p>
                    <p className="text-sm font-medium text-white">{session.location_area}</p>
                  </div>
                </div>
              )}
              {session.max_tuition && (
                <div className="flex items-start gap-3 p-3 bg-[#2A2A3D] rounded-lg border border-white/10">
                  <DollarSign className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[#E8E8ED]/60">Budget</p>
                    <p className="text-sm font-medium text-white">${(session.max_tuition / 1000).toFixed(0)}K/year</p>
                  </div>
                </div>
              )}
            </div>

            {/* Priorities */}
            {session.priorities && session.priorities.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-[#E8E8ED]/60 uppercase tracking-wide mb-2">Priorities</p>
                <div className="flex flex-wrap gap-2">
                  {session.priorities.map((p, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-[#2A2A3D] border border-teal-400/30 text-teal-300 text-sm font-medium rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Narrative */}
            {session.ai_narrative && (
              <div className="p-4 bg-[#2A2A3D] rounded-lg border border-white/10">
                <p className="text-[#E8E8ED]/80 leading-relaxed">{session.ai_narrative}</p>
              </div>
            )}
          </div>
        </div>

        {/* Shortlisted Schools */}
        {shortlistedSchools.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-teal-400" />
              Your Shortlist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shortlistedSchools.map((school) => (
                <SchoolCard
                  key={school.id}
                  school={school}
                  isShortlisted={true}
                  onViewDetails={() => {}}
                  onToggleShortlist={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top Matched Schools */}
        {schools.filter(s => !shortlistedSchools.some(sl => sl.id === s.id)).length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Top Matches</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {schools
                .filter(s => !shortlistedSchools.some(sl => sl.id === s.id))
                .map((school) => (
                  <SchoolCard
                    key={school.id}
                    school={school}
                    isShortlisted={false}
                    onViewDetails={() => {}}
                    onToggleShortlist={() => {}}
                  />
                ))}
            </div>
          </div>
        )}

        {/* CTA Footer */}
        <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-2xl p-8 border border-teal-400/30 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start Your Own Search</h2>
          <p className="text-[#E8E8ED]/70 mb-6 max-w-xl mx-auto">
            Find the perfect private school for your child with personalized AI recommendations.
          </p>
          <Link href={'/consultant'}>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-8 py-6 text-lg font-semibold">
              Create Your Profile <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
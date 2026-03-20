import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { fetchSchoolAdmins, fetchUsers } from '@/lib/api/entities-api';
import { fetchSchools, updateSchool } from '@/lib/api/schools';
import { fetchClaims } from '@/lib/api/school-claims';
import { fetchInquiries } from '@/lib/api/school-inquiries';
import { invokeFunction } from '@/lib/functions';
import { Building2, BarChart3, Mail, CreditCard, Upload, Crown, Sparkles, Image, ImagePlus, MessageSquareQuote, User as UserIcon, CalendarDays, FileText, FlaskConical, Loader2, ArrowLeft, Clock, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ProfileEditor from '@/components/school-admin/ProfileEditor';
import Analytics from '@/components/school-admin/Analytics';
import Inquiries from '@/components/school-admin/Inquiries';
import Subscription from '@/components/school-admin/Subscription';
import PhotosMediaSection from '@/components/school-admin/PhotosMediaSection';
import TestimonialsSection from '@/components/school-admin/TestimonialsSection';
import AccountSection from '@/components/school-admin/AccountSection';
import EventsSection from '@/components/school-admin/EventsSection';
import ProfileCompletenessRing from '@/components/school-admin/ProfileCompletenessRing';
import AdmissionsSection from '@/components/school-admin/AdmissionsSection';
import EnrichmentReviewSection from '@/components/school-admin/EnrichmentReviewSection';
import PhotoReviewSection from '@/components/school-admin/PhotoReviewSection';

export default function SchoolAdmin() {
  const { user: authUser, isLoadingAuth } = useAuth();

  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [newInquiryCount, setNewInquiryCount] = useState(0);
  const [pendingDiffCount, setPendingDiffCount] = useState(0);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const [pendingClaim, setPendingClaim] = useState(null);
  const [pendingSchool, setPendingSchool] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // Wait for auth to resolve before loading school data
    if (isLoadingAuth || !authUser) return;
    loadSchoolData(authUser);
  }, [authUser, isLoadingAuth]);

  // F5.5: Warn on browser navigation when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleDirtyChange = useCallback((dirty) => {
    setIsDirty(dirty);
  }, []);

  const handleViewChange = useCallback((viewId) => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    setIsDirty(false);
    setCurrentView(viewId);
  }, [isDirty]);

  const loadSchoolData = async (userData) => {
    try {
      setUser(userData);

      let resolvedSchool = null;

      // --- ADMIN IMPERSONATION BYPASS (E23-B2) ---
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateSchoolId = urlParams.get('schoolId');
      if (impersonateSchoolId) {
        const adminUsers = await fetchUsers({ email: userData.email });
        const isAdmin = adminUsers && adminUsers.length > 0 && adminUsers[0].role === 'admin';
        if (isAdmin) {
          const schoolData = await fetchSchools({ ids: [impersonateSchoolId] });
          if (schoolData && schoolData.length > 0) {
            resolvedSchool = schoolData[0];
            setSchool(resolvedSchool);
          }
        }
      }

      // --- PATH A: SchoolAdmin record lookup ---
      if (!resolvedSchool) {
        const adminRecords = await fetchSchoolAdmins({ user_id: userData.id, is_active: true });

        if (adminRecords && adminRecords.length > 0) {
          const schoolData = await fetchSchools({ ids: [adminRecords[0].school_id] });
          if (schoolData && schoolData.length > 0) {
            resolvedSchool = schoolData[0];
            setSchool(resolvedSchool);
            invokeFunction('calculateCompletenessScore', { schoolId: resolvedSchool.id }).catch(() => {});
          }
        } else {
          // --- PATH B: Legacy adminUserId fallback ---
          const schools = await fetchSchools({ admin_user_id: userData.id });
          if (schools && schools.length > 0) {
            resolvedSchool = schools[0];
            setSchool(resolvedSchool);
            invokeFunction('calculateCompletenessScore', { schoolId: resolvedSchool.id }).catch(() => {});
          }
        }
      }

      // --- PATH C: URL param with verified SchoolClaim (non-admin users) ---
      if (!resolvedSchool) {
        const urlSchoolId = urlParams.get('schoolId');
        if (urlSchoolId) {
          const claims = await fetchClaims({
            user_id: userData.id,
            school_id: urlSchoolId,
            status: 'verified'
          });
          if (claims && claims.length > 0) {
            const schoolData = await fetchSchools({ ids: [urlSchoolId] });
            if (schoolData && schoolData.length > 0) {
              resolvedSchool = schoolData[0];
              setSchool(resolvedSchool);
            }
          }
        }
      }

      // --- PATH D: Pending/rejected claim state ---
      if (!resolvedSchool) {
        try {
          const claims = await fetchClaims({ user_id: userData.id });
          if (claims && claims.length > 0) {
            const latest = claims.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            setPendingClaim(latest);
            if (latest.school_id) {
              const schoolData = await fetchSchools({ ids: [latest.school_id] });
              if (schoolData && schoolData.length > 0) setPendingSchool(schoolData[0]);
            }
          }
        } catch (e) { /* non-blocking */ }
      }

      // Load badges for resolved school
      if (resolvedSchool) {
        try {
          const inquiries = await fetchInquiries({ school_id: resolvedSchool.id, inquiry_type: 'tour_request' });
          const newCount = inquiries.filter(i => !i.tour_status || i.tour_status === 'new').length;
          setNewInquiryCount(newCount);
        } catch (e) { /* non-blocking */ }

        try {
          const diffs = await fetch(`/api/school-enrichment?school_id=${resolvedSchool.id}&status=pending`).then(r => r.ok ? r.json() : []);
          setPendingDiffCount(diffs.length);
        } catch (e) { /* non-blocking */ }

        try {
          const photos = await fetch(`/api/school-photos?school_id=${resolvedSchool.id}&status=pending`).then(r => r.ok ? r.json() : []);
          setPendingPhotoCount(photos.length);
        } catch (e) { /* non-blocking */ }
      }
    } catch (error) {
      console.error('Failed to load school data:', error);
      setLoadError('Failed to load school data. Please refresh the page or try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchool = async (updatedData) => {
    if (!school) return;

    setIsSaving(true);
    try {
      await updateSchool(school.id, updatedData);
      const updated = { ...school, ...updatedData };
      setSchool(updated);
      setIsDirty(false);
      // Post-save: recalculate completeness score server-side (non-blocking)
      invokeFunction('calculateCompletenessScore', { schoolId: school.id })
        .then(res => {
          if (res?.data?.completeness_score != null) {
            setSchool(s => ({ ...s, completeness_score: res.data.completeness_score }));
          }
        })
        .catch(e => console.warn('completenessScore update failed:', e));
    } catch (error) {
      console.error('Failed to save school:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoFill = async () => {
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const [enrichResult, photoResult] = await Promise.allSettled([
        invokeFunction('enrichSchoolFromWeb', { schoolId: school.id }),
        invokeFunction('scrapeSchoolPhotos', { schoolId: school.id })
      ]);
      const enrichOk = enrichResult.status === 'fulfilled';
      const photoOk = photoResult.status === 'fulfilled';
      if (!enrichOk && !photoOk) {
        setEnrichError('Website scan failed. Please check the website URL in your profile and try again.');
        return;
      }
      try {
        const diffs = await fetch(`/api/school-enrichment?school_id=${school.id}&status=pending`).then(r => r.ok ? r.json() : []);
        setPendingDiffCount(diffs.length);
      } catch {}
      try {
        const photos = await fetch(`/api/school-photos?school_id=${school.id}&status=pending`).then(r => r.ok ? r.json() : []);
        setPendingPhotoCount(photos.length);
      } catch {}
      setCurrentView('enrichment');
    } catch (err) {
      setEnrichError('Something went wrong. Please try again.');
    } finally {
      setIsEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md rounded-xl border border-red-200 bg-red-50 p-12">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Something Went Wrong</h2>
          <p className="text-red-700 text-sm mb-4">{loadError}</p>
          <Button onClick={() => { setLoadError(null); setLoading(true); loadSchoolData(authUser); }} className="bg-red-600 hover:bg-red-700 text-white">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!school) {
    if (pendingClaim && (pendingClaim.status === 'pending' || pendingClaim.status === 'pending_review')) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md rounded-xl border border-blue-200 bg-blue-50 p-12">
            <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Submission Under Review</h2>
            <p className="text-blue-700 text-sm">
              Your submission for <span className="font-semibold">{pendingSchool?.name || 'your school'}</span> was received on{' '}
              {new Date(pendingClaim.created_at).toLocaleDateString('en-CA')}.
            </p>
            <p className="text-blue-600 text-sm mt-2">We're reviewing your submission. You'll get access once approved.</p>
          </div>
        </div>
      );
    }

    if (pendingClaim && pendingClaim.status === 'rejected') {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md rounded-xl border border-red-200 bg-red-50 p-12">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Submission Not Approved</h2>
            <p className="text-red-700 text-sm">
              Your submission for <span className="font-semibold">{pendingSchool?.name || 'your school'}</span> was not approved.
            </p>
            <p className="text-red-600 text-sm mt-2">Please contact support for details.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <Building2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No School Profile Found</h2>
          <p className="text-slate-600 mb-6">
            You don't have a school profile associated with your account. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  const tierColors = {
    standard: 'bg-slate-100 text-slate-700',
    growth: 'bg-blue-100 text-blue-700',
    pro: 'bg-amber-100 text-amber-700'
  };

  const tierIcons = {
    standard: null,
    growth: <Sparkles className="h-3 w-3" />,
    pro: <Crown className="h-3 w-3" />
  };

  const tierLabel = {
    standard: 'Standard',
    growth: 'Growth',
    pro: 'Professional'
  };

  const TIER_MIGRATION = { free: 'standard', basic: 'growth', premium: 'pro', professional: 'pro' };
  const tier = TIER_MIGRATION[school.school_tier] || school.school_tier || 'standard';
  const hasTourFeatures = tier === 'growth' || tier === 'pro';
  const hasAllFeatures = tier === 'pro';

  const navGroups = [
    {
      label: 'AI Tools',
      items: [
        { id: 'auto-fill', label: 'AI Auto-Fill', icon: Sparkles, action: handleAutoFill, showLoading: isEnriching },
        { id: 'enrichment', label: 'Enrichment Review', icon: FlaskConical, badge: pendingDiffCount },
        { id: 'photo-review', label: 'Photo Review', icon: ImagePlus, badge: pendingPhotoCount },
      ],
    },
    {
      label: 'Content',
      items: [
        { id: 'profile', label: 'Profile Editor', icon: Building2 },
        { id: 'media', label: 'Photos & Media', icon: Image },
        { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
      ],
    },
    {
      label: 'Engagement',
      items: [
        { id: 'admissions', label: 'Admissions', icon: FileText },
        { id: 'events', label: 'Events & Open Houses', icon: CalendarDays, locked: !hasTourFeatures, lockLabel: 'Growth' },
        { id: 'inquiries', label: 'Inquiries', icon: Mail, badge: newInquiryCount, locked: !hasTourFeatures, lockLabel: 'Growth' },
        { id: 'analytics', label: 'Analytics', icon: BarChart3, locked: !hasAllFeatures, lockLabel: 'Pro' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { id: 'subscription', label: 'Subscription', icon: CreditCard },
        { id: 'account', label: 'Account', icon: UserIcon },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{school.name}</h1>
            <p className="text-sm text-slate-500">{school.city}, {school.region}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Unsaved changes
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${tierColors[tier]}`}>
            {tierIcons[tier]}
            <span className="uppercase">{tierLabel[tier]}</span>
          </div>
        </div>
      </header>

      {enrichError && (
        <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-sm text-red-700">
          <span>{enrichError}</span>
          <button onClick={() => setEnrichError(null)} className="text-red-400 hover:text-red-600 ml-2">x</button>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r flex flex-col sticky top-0 h-screen overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navGroups.map((group, groupIdx) => (
              <div key={group.label}>
                {groupIdx > 0 && <div className="my-3 border-t border-slate-100" />}
                <p className="px-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isAction = !!item.action;
                  const isActive = !isAction && currentView === item.id;
                  const handleClick = isAction ? item.action : () => handleViewChange(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => !item.locked && !item.showLoading && handleClick()}
                      disabled={item.locked || item.showLoading}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                        ${isActive
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : item.locked || item.showLoading
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      {item.showLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                      <span>{item.label}</span>
                      {item.locked && (
                        <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {item.lockLabel || 'Upgrade'}
                        </span>
                      )}
                      {!item.locked && item.badge > 0 && (
                        <span className="ml-auto text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-slate-100 p-4 mt-auto">
            <Link 
              href={'/'} 
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to NextSchool</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {currentView === 'profile' && (
            <ProfileEditor school={school} onSave={handleSaveSchool} isSaving={isSaving} onDirtyChange={handleDirtyChange} />
          )}
          {currentView === 'media' && (
            <div className="p-6 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Photos & Media</h2>
              <PhotosMediaSection school={school} onUpdate={(field, value) => setSchool({ ...school, [field]: value })} />
            </div>
          )}
          {currentView === 'testimonials' && (
            <TestimonialsSection school={school} />
          )}
          {currentView === 'admissions' && (
            <div className="p-6 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Admissions</h2>
              <AdmissionsSection school={school} onUpdate={(field, value) => setSchool({ ...school, [field]: value })} />
            </div>
          )}
          {currentView === 'events' && (
            <EventsSection school={school} />
          )}
          {currentView === 'inquiries' && (
            <Inquiries schoolId={school.id} />
          )}
          {currentView === 'analytics' && (
             <Analytics school={school} />
           )}
           {currentView === 'subscription' && (
            <Subscription school={school} onUpdate={() => loadSchoolData(authUser)} />
          )}
          {currentView === 'account' && (
            <AccountSection school={school} />
          )}
          {currentView === 'enrichment' && (
            <EnrichmentReviewSection school={school} onCountChange={(count) => setPendingDiffCount(count)} />
          )}
          {currentView === 'photo-review' && (
            <PhotoReviewSection school={school} onUpdate={(field, value) => setSchool({ ...school, [field]: value })} onCountChange={(count) => setPendingPhotoCount(count)} />
            )}
        </main>
      </div>
    </div>
  );
}
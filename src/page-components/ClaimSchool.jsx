import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { School, SchoolClaim, SchoolAdmin, User } from '@/lib/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Search, HelpCircle, Lock, Clock } from 'lucide-react';
import Navbar from '@/components/navigation/Navbar';
import Footer from '@/components/navigation/Footer';
import Link from 'next/link';
import { debounce } from 'lodash';
import DisputeForm from '@/components/claim/DisputeForm';

const STATUS_LABELS = {
  pending_review: 'Under Review',
  verified: 'Approved'
};

export default function ClaimSchool() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, isAuthenticated: authIsAuthenticated, navigateToLogin } = useAuth();
  const [user, setUser] = useState(null);
  const [existingClaim, setExistingClaim] = useState(null);
  const [claimSchoolName, setClaimSchoolName] = useState('');
  const [cancellingClaim, setCancellingClaim] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [schoolId, setSchoolId] = useState(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('schoolId') : null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [alreadyClaimed, setAlreadyClaimed] = useState(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const handleSchoolSelect = (selectedSchoolId) => {
    setSchoolId(selectedSchoolId);
    setLoading(true);
    setStep(1);
    router.push(`/claim-school?schoolId=${selectedSchoolId}`);
  };

  const searchSchoolsDebounced = useCallback(
    debounce(async (term) => {
      if (term.length < 2) {
        setSearchResults([]);
        setSearchingSchools(false);
        return;
      }
      setSearchingSchools(true);
      try {
        const schools = await School.filter({
          name: { "$regex": term, "$options": "i" }
        }, null, 50);
        setSearchResults(schools);
      } catch (error) {
        console.error('Failed to search schools:', error);
        setSearchResults([]);
      } finally {
        setSearchingSchools(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchSchoolsDebounced(searchTerm);
  }, [searchTerm, searchSchoolsDebounced]);

  useEffect(() => {
    const init = async () => {
      if (!authIsAuthenticated) {
        navigateToLogin(pathname + (typeof window !== 'undefined' ? window.location.search : ''));
        return;
      }
      const userData = authUser;
      setUser(userData);

      try {
        // Check if user already has an active claim
        const claims = await SchoolClaim.filter({ claimed_by: userData.id });
        const activeClaim = claims.find(c => ['pending_review', 'verified'].includes(c.status));
        if (activeClaim) {
          const schools = await School.filter({ id: activeClaim.school_id });
          setClaimSchoolName(schools[0]?.name || '');
          setExistingClaim(activeClaim);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to check existing claims:', err);
      }

      if (schoolId) {
        loadSchool();
      } else {
        setLoading(false);
      }
    };
    init();
  }, [schoolId, authIsAuthenticated]);

  const loadSchool = async () => {
    try {
      const schools = await School.filter({ id: schoolId });
      if (schools && schools.length > 0) {
        const s = schools[0];
        setSchool(s);
        // Check if already claimed by another user
        if (s.claim_status === 'claimed') {
          const admins = await SchoolAdmin.filter({ school_id: schoolId, role: 'owner', is_active: true });
          if (admins.length > 0 && admins[0].user_id) {
            const users = await User.filter({ id: admins[0].user_id });
            const ownerEmail = users[0]?.email || '';
            const domain = ownerEmail.split('@')[1] || null;
            setAlreadyClaimed({ domain });
          } else {
            setAlreadyClaimed({ domain: null });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load school:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    if (!formData.name || !formData.role || !formData.email) {
      setFormError('Please fill in all fields.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    try {
      // Create SchoolClaim record — goes straight to pending_review for admin approval
      await SchoolClaim.create({
        school_id: schoolId,
        claimed_by: user?.id,
        claimant_name: formData.name,
        claimant_role: formData.role,
        claimant_email: formData.email,
        verification_method: 'admin_review',
        status: 'pending_review'
      });

      // Update school claim status to pending
      await School.update(schoolId, {
        claim_status: 'pending'
      });

      // Go to success step
      setStep(3);
    } catch (error) {
      console.error('Failed to create claim:', error);
      setFormError(error?.message || error?.details || 'Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClaim = async () => {
    if (!showCancelConfirm) return;
    setCancellingClaim(true);
    try {
      await SchoolClaim.update(existingClaim.id, { status: 'cancelled' });
      if (existingClaim.status === 'pending_review') {
        await School.update(existingClaim.school_id, { claim_status: null });
      }
      setExistingClaim(null);
      setShowCancelConfirm(false);
      setClaimSchoolName('');
    } finally {
      setCancellingClaim(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!schoolId || !school) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-4 text-center">Claim Your School Profile</h1>
            <p className="text-slate-600 mb-8 text-center">
              Search for your school to begin the claim process.
            </p>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search for your school by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full text-lg"
                autoFocus
              />
            </div>

            {searchingSchools ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {searchResults.map((result) => (
                  <Button
                    key={result.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto p-3 hover:bg-slate-100"
                    onClick={() => handleSchoolSelect(result.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{result.name}</span>
                      <span className="text-sm text-slate-500">{result.city}, {result.province_state}</span>
                    </div>
                  </Button>
                ))}
              </div>
            ) : searchTerm.length >= 2 && !searchingSchools ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-600">No schools found for &quot;{searchTerm}&quot;</p>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">Start typing to search for your school.</div>
            )}

            <div className="mt-8 pt-6 border-t">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-700 mb-1">Don&apos;t see your school?</p>
                  <p>
                    <Link href="/contact" className="text-teal-600 hover:underline">Contact us</Link> to have your school added to our database.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">School Not Found</h1>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Existing claim — Approved */}
        {existingClaim && existingClaim.status === 'verified' && (
          <Card className="p-8">
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Claim Approved!</h1>
              <p className="text-lg text-slate-700 font-medium mb-2">{claimSchoolName}</p>
              <p className="text-slate-600 mb-8">Your school claim has been verified. You can now manage your school&apos;s profile.</p>
              <Button
                onClick={() => router.push(`/school-admin?schoolId=${existingClaim.school_id}`)}
                className="bg-teal-600 hover:bg-teal-700 px-8"
              >
                Go to School Admin
              </Button>
            </div>
          </Card>
        )}

        {/* Existing claim — Pending */}
        {existingClaim && existingClaim.status !== 'verified' && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-7 w-7 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Claim In Progress</h1>
              <p className="text-lg text-slate-700 font-medium">{claimSchoolName}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {STATUS_LABELS[existingClaim.status] || existingClaim.status}
                </span>
              </div>
              {existingClaim.created_at && (
                <p className="text-xs text-slate-500 mt-1">
                  Submitted {new Date(existingClaim.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">Most claims are reviewed within 1–2 business days.</p>
            </div>

            <div className="text-center space-y-3">
              {!showCancelConfirm ? (
                <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(true)} className="text-slate-600">
                  Cancel Claim
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-700 font-medium">Are you sure you want to cancel this claim?</p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)}>Keep It</Button>
                    <Button size="sm" onClick={handleCancelClaim} disabled={cancellingClaim} className="bg-red-600 hover:bg-red-700 text-white">
                      {cancellingClaim ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Yes, Cancel
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <a href="mailto:support@nextschool.ca" className="text-xs text-teal-600 hover:underline">
                  Contact support
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* Already claimed state */}
        {!existingClaim && alreadyClaimed && !showDisputeForm && (
          <Card className="p-8">
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-7 w-7 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-3">This school is already claimed</h1>
              <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                This school was claimed by someone at{' '}
                <strong>{alreadyClaimed.domain || 'another organization'}</strong>.
                If this is an error, request access below.
              </p>
              <Button
                onClick={() => setShowDisputeForm(true)}
                className="bg-teal-600 hover:bg-teal-700 px-8"
              >
                Request Access
              </Button>
            </div>
          </Card>
        )}

        {/* Dispute form */}
        {!existingClaim && alreadyClaimed && showDisputeForm && (
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Request Access</h2>
            <DisputeForm
              schoolId={schoolId}
              schoolName={school.name}
              onCancel={() => setShowDisputeForm(false)}
            />
          </Card>
        )}

        {/* Step 1: Intro */}
        {!existingClaim && !alreadyClaimed && step === 1 && (
          <Card className="p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">Claim {school.name}</h1>
              <p className="text-slate-600 mb-8 text-lg">Manage your school&apos;s profile on NextSchool</p>
              <p className="text-slate-600 mb-8">
                Submit a claim request and an admin will review it. Once approved, you can update school information, manage inquiries, and access analytics.
              </p>
              <Button
                onClick={() => setStep(2)}
                className="bg-teal-600 hover:bg-teal-700 px-8 py-2"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Claim Information */}
        {!existingClaim && !alreadyClaimed && step === 2 && (
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Information</h2>

            {formError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm">{formError}</p>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Your Role at School</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">Select your role</option>
                  <option value="Head of School">Head of School</option>
                  <option value="Director of Admissions">Director of Admissions</option>
                  <option value="Registrar">Registrar</option>
                  <option value="Marketing/Communications">Marketing/Communications</option>
                  <option value="Administrative Staff">Administrative Staff</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your.name@school.edu"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleStep2Submit}
                disabled={isSubmitting}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Claim
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Success */}
        {!existingClaim && !alreadyClaimed && step === 3 && (
          <Card className="p-8">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Claim Submitted!</h2>
              <p className="text-slate-600 mb-4">
                Your claim has been submitted for admin review. Most claims are reviewed within 1–2 business days.
              </p>
              <p className="text-sm text-slate-500 mb-8">
                You&apos;ll be notified once your claim is approved.
              </p>
              <Link href="/">
                <Button className="bg-teal-600 hover:bg-teal-700 px-8">
                  Back to Home
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}

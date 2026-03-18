import { useState, useEffect } from "react";
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/lib/AuthContext';
import { School, SchoolClaim } from '@/lib/entities';
import Navbar from "@/components/navigation/Navbar";

// --- T-SP-009: Duplicate detection helpers (shared with Portal) ---
function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/\bthe\b/g, "")
    .replace(/\bst\.\b/g, "saint")
    .replace(/\bst\b/g, "saint")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Dice coefficient similarity (0–1)
function diceSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  let intersection = 0;
  for (const bg of aSet) if (bSet.has(bg)) intersection++;
  return (2 * intersection) / (aSet.size + bSet.size);
}

function findDuplicates(name, city, allSchools) {
  const normName = normalize(name);
  const normCity = normalize(city);
  return allSchools
    .map(s => {
      const nameSim = diceSimilarity(normName, normalize(s.name || ""));
      const citySim = diceSimilarity(normCity, normalize(s.city || ""));
      // weighted: name 70%, city 30%
      const score = nameSim * 0.7 + citySim * 0.3;
      return { ...s, _score: score };
    })
    .filter(s => s._score >= 0.8)
    .sort((a, b) => b._score - a._score)
    .slice(0, 3);
}

const SCHOOL_TYPES = ["Day School", "Boarding School", "Private", "All-Girls", "All-Boys", "Religious", "Arts-Focused", "STEM", "Military", "Online", "General"];
const GENDER_POLICIES = ["Co-ed", "All-Boys", "All-Girls", "Co-ed with single-gender classes"];
const COUNTRIES = ["Canada", "United States", "United Kingdom", "Australia", "Other"];

const INITIAL_FORM = {
  name: "",
  city: "",
  provinceState: "",
  country: "Canada",
  schoolTypeLabel: "",
  lowestGrade: "",
  highestGrade: "",
  genderPolicy: "",
  email: "",
};

export default function SubmitSchool() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { user: authUser, isAuthenticated: authIsAuthenticated, navigateToLogin } = useAuth();

  // Auth gate + pre-fill
  useEffect(() => {
    const init = async () => {
      const isAuth = authIsAuthenticated;
      if (!isAuth) {
        navigateToLogin('/submit-school');
        return;
      }
      const userData = authUser;
      setCurrentUser(userData);
      setAuthLoading(false);

      const params = new URLSearchParams(window.location.search);
      const name = params.get("name");
      if (name) setForm(f => ({ ...f, name }));
    };
    init();
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
    setDuplicates([]);
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.provinceState.trim()) e.provinceState = "Required";
    if (!form.country) e.country = "Required";
    if (!form.schoolTypeLabel) e.schoolTypeLabel = "Required";
    if (form.lowestGrade === "") e.lowestGrade = "Required";
    if (form.highestGrade === "") e.highestGrade = "Required";
    if (!form.genderPolicy) e.genderPolicy = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // T-SP-009: Duplicate check
    setChecking(true);
    const allSchools = await School.list('-updatedDate', undefined, 500);
    const dupes = findDuplicates(form.name, form.city, allSchools);
    setChecking(false);

    if (dupes.length > 0) {
      setDuplicates(dupes);
      return;
    }

    // Submit
    setSubmitting(true);
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
    const newSchool = await School.create({
      name: form.name.trim(),
      city: form.city.trim(),
      provinceState: form.provinceState.trim(),
      country: form.country,
      region: form.country === "Canada" ? "Canada" : form.country === "United States" ? "United States" : form.country === "United Kingdom" ? "United Kingdom" : "Europe",
      schoolTypeLabel: form.schoolTypeLabel,
      lowestGrade: Number(form.lowestGrade),
      highestGrade: Number(form.highestGrade),
      genderPolicy: form.genderPolicy,
      slug,
      status: "draft",
      claimStatus: "unclaimed",
      source: "school_submitted",
      verified: false,
      userId: currentUser.id,
    });

    // Create SchoolClaim record
    await SchoolClaim.create({
      schoolId: newSchool.id,
      claimantEmail: form.email,
      claimantName: form.name,
      claimantRole: 'submitter',
      status: 'pending',
      userId: currentUser.id,
      verificationMethod: 'email_domain',
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar minimal />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
          <div className="max-w-md text-center">
            <div className="h-16 w-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-teal-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Submission Received</h1>
            <p className="text-lg text-slate-600 mb-8">
              Thank you! Your school submission is under review. You'll be notified once it's approved.
            </p>
            <Link href={"/portal"}>
              <Button variant="outline">Back to School Search</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar minimal />
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href={"/portal"} className="text-sm text-teal-600 hover:underline">← Back to search</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-1">Add Your School</h1>
          <p className="text-slate-500">Fill in your school's basic details. We'll review and publish your profile within a few days.</p>
        </div>

        {/* Duplicate warning */}
        {duplicates.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="font-medium text-amber-900">We found similar schools already in our directory:</p>
            </div>
            <div className="space-y-2">
              {duplicates.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-200">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{d.name}</p>
                    <p className="text-xs text-slate-500">{[d.city, d.provinceState].filter(Boolean).join(", ")}</p>
                  </div>
                  <Link href={"/claim-school" + `?schoolId=${d.id}`}>
                    <Button size="sm" variant="outline" className="text-teal-700 border-teal-300 gap-1">
                      Claim instead <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-sm text-amber-700 mt-3">
              Is your school different? Double-check the name and city below, then submit again.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* School Name */}
          <Field label="School Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. St. Michael's College School"
              className={inputCls(errors.name)}
            />
          </Field>

          {/* City + Province */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required error={errors.city}>
              <input type="text" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Toronto" className={inputCls(errors.city)} />
            </Field>
            <Field label="Province / State" required error={errors.provinceState}>
              <input type="text" value={form.provinceState} onChange={e => set("provinceState", e.target.value)} placeholder="ON" className={inputCls(errors.provinceState)} />
            </Field>
          </div>

          {/* Country */}
          <Field label="Country" required error={errors.country}>
            <select value={form.country} onChange={e => set("country", e.target.value)} className={inputCls(errors.country)}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          {/* School Type */}
          <Field label="School Type" required error={errors.schoolTypeLabel}>
            <select value={form.schoolTypeLabel} onChange={e => set("schoolTypeLabel", e.target.value)} className={inputCls(errors.schoolTypeLabel)}>
              <option value="">Select type…</option>
              {SCHOOL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>

          {/* Grade Range */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lowest Grade" required error={errors.lowestGrade}>
              <input type="number" value={form.lowestGrade} onChange={e => set("lowestGrade", e.target.value)} placeholder="e.g. 1" min={-2} max={12} className={inputCls(errors.lowestGrade)} />
            </Field>
            <Field label="Highest Grade" required error={errors.highestGrade}>
              <input type="number" value={form.highestGrade} onChange={e => set("highestGrade", e.target.value)} placeholder="e.g. 12" min={-2} max={12} className={inputCls(errors.highestGrade)} />
            </Field>
          </div>

          {/* Gender Policy */}
          <Field label="Gender Policy" required error={errors.genderPolicy}>
            <select value={form.genderPolicy} onChange={e => set("genderPolicy", e.target.value)} className={inputCls(errors.genderPolicy)}>
              <option value="">Select…</option>
              {GENDER_POLICIES.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>

          {/* Work Email */}
          <Field label="Your Work Email" required error={errors.email}>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@yourschool.ca" className={inputCls(errors.email)} />
            <p className="text-xs text-slate-400 mt-1">Used to notify you when your school is approved.</p>
          </Field>

          <Button
            type="submit"
            disabled={submitting || checking}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 text-base"
          >
            {checking ? "Checking for duplicates…" : submitting ? "Submitting…" : "Submit School"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function inputCls(error) {
  return `w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}`;
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
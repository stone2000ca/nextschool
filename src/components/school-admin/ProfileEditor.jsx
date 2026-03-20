import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Eye, X, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Testimonial } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';

// =============================================================================
// Inline ring chart (weighted score only)
// =============================================================================
function isFilled(value) {
  if (typeof value === 'boolean') return value !== null && value !== undefined;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return value !== null && value !== undefined;
}

const TIER_WEIGHTS = [
  { fields: ['name','city','province_state','country','lowest_grade','highest_grade','gender_policy','day_tuition','school_type_label','email','address','phone'], weight: 50 },
  { fields: ['description','mission_statement','website','livingArrangements','faith_based','languagesOfInstruction','avg_class_size','student_teacher_ratio','founded','enrollment','virtual_tour_url','campus_feel','financial_aid_available'], weight: 30 },
  { fields: ['artsPrograms','sportsPrograms','clubs','facilities','specialEdPrograms','curriculum','accreditations','specializations','values','teachingPhilosophy','highlights','_testimonials'], weight: 15 },
  { fields: ['logo_url','header_photo_url','photo_gallery'], weight: 5 }, // media fields kept for score only
];

function calcWeightedScore(data, testimonialCount = 0) {
  if (!data) return 0;
  let total = 0;
  for (const tier of TIER_WEIGHTS) {
    const filled = tier.fields.filter(f => {
      if (f === '_testimonials') return testimonialCount > 0;
      return isFilled(data[f]);
    }).length;
    total += (filled / tier.fields.length) * tier.weight;
  }
  return Math.round(total);
}

function CompletenessRing({ score }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#14b8a6' : score >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="9" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900 leading-tight">{score}%</span>
      </div>
    </div>
  );
}

// =============================================================================
// Tier definitions
// =============================================================================
const TIERS = [
  {
    id: 'tier1',
    label: 'Tier 1 — Required',
    color: 'red',
    weight: 0.5,
    motivational: 'Essential information families need to find your school.',
    fields: ['name', 'city', 'province_state', 'country', 'lowest_grade', 'highest_grade', 'gender_policy', 'day_tuition', 'school_type_label', 'email', 'address', 'phone'],
  },
  {
    id: 'tier2',
    label: 'Tier 2 — Important',
    color: 'amber',
    weight: 0.3,
    motivational: 'Schools with these fields completed appear in 3x more results.',
    fields: ['description', 'mission_statement', 'website', 'livingArrangements', 'faith_based', 'languagesOfInstruction', 'avg_class_size', 'student_teacher_ratio', 'founded', 'enrollment', 'virtual_tour_url', 'campus_feel', 'financial_aid_available'],
  },
  {
    id: 'tier3',
    label: 'Tier 3 — Enrichment',
    color: 'teal',
    weight: 0.15,
    motivational: 'Add depth to your profile with testimonials and details that set you apart.',
    fields: ['artsPrograms', 'sportsPrograms', 'clubs', 'facilities', 'specialEdPrograms', 'curriculum', 'accreditations', 'specializations', 'values', 'teaching_philosophy', 'highlights', '_testimonials'],
  },
];

function countFilled(formData, fields, testimonialCount = 0) {
  return fields.filter(f => {
    if (f === '_testimonials') return testimonialCount > 0;
    return isFilled(formData[f]);
  }).length;
}

// Tier header color classes
const TIER_COLORS = {
  red:    { header: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400' },
  amber:  { header: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  teal:   { header: 'bg-teal-50 border-teal-200',   badge: 'bg-teal-100 text-teal-700',   dot: 'bg-teal-500' },
  indigo: { header: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
};

// =============================================================================
// TierSection — collapsible accordion block
// =============================================================================
function TierSection({ tier, filled, open, onToggle, children }) {
  const total = tier.fields.length;
  const cls = TIER_COLORS[tier.color];
  const isComplete = filled === total;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 ${cls.header} border-b transition-colors hover:brightness-95`}
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${cls.dot}`} />
          <span className="font-semibold text-slate-800">{tier.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls.badge}`}>
            {filled}/{total} filled
          </span>
          {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        </div>
        <div className="flex items-center gap-3">

          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="p-5 bg-white space-y-4">
          <p className="text-sm italic text-slate-400 -mt-1">{tier.motivational}</p>
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TagInput
// =============================================================================
function TagInput({ label, field, placeholder, formData, onChange, required }) {
  const [inputValue, setInputValue] = useState('');
  const values = formData[field] || [];

  const add = () => {
    if (!inputValue.trim()) return;
    onChange(field, [...values, inputValue.trim()]);
    setInputValue('');
  };

  const remove = (idx) => {
    onChange(field, values.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="flex items-center gap-1">
            {item}
            <button onClick={() => remove(idx)} className="ml-1 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

// =============================================================================
// FieldLabel
// =============================================================================
function FieldLabel({ children, required, aiEnriched }) {
  return (
    <Label className="flex items-center gap-2">
      {children}
      {required && <span className="text-red-500 font-bold">*</span>}
      {aiEnriched && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-filled</span>}
    </Label>
  );
}

// =============================================================================
// ImageUploadField
// =============================================================================
function ImageUploadField({ label, field, hint, formData, onChange }) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploadProgress(10);
    const interval = setInterval(() => setUploadProgress(p => Math.min(p + 10, 90)), 100);
    try {
      const { file_url } = await invokeFunction('uploadFile', { file });
      clearInterval(interval);
      setUploadProgress(100);
      onChange(field, file_url);
      setTimeout(() => { setUploadProgress(0); setPreview(null); }, 1000);
    } catch {
      clearInterval(interval);
      setUploadProgress(0);
      alert('Upload failed. Please try again.');
    }
  };

  const currentUrl = formData[field];

  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      {(currentUrl || preview) && (
        <div className="mb-2">
          <img
            src={preview || currentUrl}
            alt={label}
            className={field === 'logo_url' ? 'w-24 h-24 object-contain border rounded-lg bg-white p-2' : 'w-full h-40 object-cover rounded-lg'}
          />
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleUpload}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
      />
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-2 bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-teal-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main ProfileEditor
// =============================================================================
export default function ProfileEditor({ school, onSave, isSaving, onDirtyChange }) {
  const [formData, setFormData] = useState(school);
  const [dirtyFields, setDirtyFields] = useState({});
  const [autoSaved, setAutoSaved] = useState(false);
  const [verifiedFields, setVerifiedFields] = useState(school?.verified_fields || {});
  const [openTiers, setOpenTiers] = useState({ tier1: true, tier2: false, tier3: false });
  const [testimonialCount, setTestimonialCount] = useState(0);

  useEffect(() => {
    setFormData(school);
    setDirtyFields({});
    setVerifiedFields(school?.verified_fields || {});
    if (school?.id) {
      Testimonial.filter({ school_id: school.id })
        .then(list => setTestimonialCount(list.length))
        .catch(() => {});
    }
  }, [school]);

  useEffect(() => {
    onDirtyChange?.(Object.keys(dirtyFields).length > 0);
  }, [dirtyFields, onDirtyChange]);

  const handleChange = (field, value) => {
    const updatedVerified = verifiedFields[field] ? verifiedFields : { ...verifiedFields, [field]: true };
    setVerifiedFields(updatedVerified);
    setDirtyFields(prev => ({ ...prev, [field]: value }));
    setFormData(prev => ({ ...prev, [field]: value, verifiedFields: updatedVerified }));
  };

  const [showValidation, setShowValidation] = useState(false);

  const handleSave = async () => {
    if (showTier1Warning) {
      setShowValidation(true);
      setOpenTiers(prev => ({ ...prev, tier1: true }));
      return;
    }
    if (Object.keys(dirtyFields).length === 0) {
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
      return;
    }
    const payload = { ...dirtyFields };
    // Derive boarding_available from livingArrangements for backward compatibility
    if (payload.living_arrangements || formData.living_arrangements) {
      payload.boarding_available = (payload.living_arrangements || formData.living_arrangements || []).includes('Boarding');
    }
    if (Object.keys(verifiedFields).length > 0) {
      payload.verifiedFields = verifiedFields;
    }
    await onSave(payload);
    setDirtyFields({});
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  };

  const toggleTier = (tierId) => setOpenTiers(prev => ({ ...prev, [tierId]: !prev[tierId] }));

  const isAI = (field) => school?.aiEnrichedFields?.includes(field) && !verifiedFields[field];

  const weightedScore = calcWeightedScore(formData, testimonialCount);

  // Tier 1 completeness for warning banner
  const tier1Filled = countFilled(formData, TIERS[0].fields, testimonialCount);
  const tier1Total = TIERS[0].fields.length;
  const showTier1Warning = tier1Filled < tier1Total;

  // Helper: is this Tier 1 field empty and validation triggered?
  const v = (field) => showValidation && !isFilled(formData[field]);

  // ==========================================================================
  // Tier 1 fields
  // ==========================================================================
  const tier1Content = (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <FieldLabel required aiEnriched={isAI('name')}>School Name</FieldLabel>
          <Input value={formData.name || ''} onChange={(e) => handleChange('name', e.target.value)} className={`${isAI('name') ? 'bg-blue-50' : ''} ${v('name') ? 'border-red-500' : ''}`} />
          {v('name') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>City</FieldLabel>
          <Input value={formData.city || ''} onChange={(e) => handleChange('city', e.target.value)} className={v('city') ? 'border-red-500' : ''} />
          {v('city') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Province/State</FieldLabel>
          <Input value={formData.province_state || ''} onChange={(e) => handleChange('province_state', e.target.value)} className={v('province_state') ? 'border-red-500' : ''} />
          {v('province_state') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Country</FieldLabel>
          <Input value={formData.country || ''} onChange={(e) => handleChange('country', e.target.value)} className={v('country') ? 'border-red-500' : ''} />
          {v('country') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>School Type</FieldLabel>
          <Select value={formData.school_type_label || ''} onValueChange={(val) => handleChange('school_type_label', val)}>
            <SelectTrigger className={v('school_type_label') ? 'border-red-500' : ''}><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {['Independent','Montessori','Waldorf','International','Religious','Arts-Focused','STEM-Focused','Military','Special Needs','Online'].map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {v('school_type_label') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Lowest Grade</FieldLabel>
          <Input type="number" value={formData.lowest_grade ?? ''} onChange={(e) => handleChange('lowest_grade', parseInt(e.target.value))} placeholder="-2 = PK, -1 = JK, 0 = K" className={v('lowest_grade') ? 'border-red-500' : ''} />
          {v('lowest_grade') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Highest Grade</FieldLabel>
          <Input type="number" value={formData.highest_grade ?? ''} onChange={(e) => handleChange('highest_grade', parseInt(e.target.value))} className={v('highest_grade') ? 'border-red-500' : ''} />
          {v('highest_grade') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Gender Policy</FieldLabel>
          <Select value={formData.gender_policy || ''} onValueChange={(val) => handleChange('gender_policy', val)}>
            <SelectTrigger className={v('gender_policy') ? 'border-red-500' : ''}><SelectValue placeholder="Select policy" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Co-ed">Co-ed</SelectItem>
              <SelectItem value="All-Boys">All-Boys</SelectItem>
              <SelectItem value="All-Girls">All-Girls</SelectItem>
              <SelectItem value="Co-ed with single-gender classes">Co-ed with single-gender classes</SelectItem>
            </SelectContent>
          </Select>
          {v('gender_policy') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <FieldLabel required>Day Tuition (Annual)</FieldLabel>
          <Input type="number" value={formData.day_tuition || ''} onChange={(e) => handleChange('day_tuition', parseFloat(e.target.value))} placeholder="e.g. 25000" className={v('day_tuition') ? 'border-red-500' : ''} />
          {v('day_tuition') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={formData.currency || 'CAD'} onValueChange={(val) => handleChange('currency', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <FieldLabel required>Admissions Email</FieldLabel>
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="admissions@yourschool.ca"
            className={v('email') ? 'border-red-500' : ''}
          />
          {v('email') && <p className="text-xs text-red-500 mt-1">This field is required</p>}
          <p className="text-xs text-slate-500 mt-1">Tour requests and parent inquiries will be sent to this email.</p>
        </div>
        <div>
          <Label>Address</Label>
          <Input value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} placeholder="Street address" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={formData.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} placeholder="Contact phone number" />
        </div>
      </div>
    </>
  );

  // ==========================================================================
  // Tier 2 fields
  // ==========================================================================
  const tier2Content = (
    <div className="space-y-4">
      <div>
        <FieldLabel aiEnriched={isAI('description')}>School Description</FieldLabel>
        <Textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={4} className={isAI('description') ? 'bg-blue-50 border-blue-200' : ''} />
      </div>
      <div>
        <FieldLabel aiEnriched={isAI('mission_statement')}>Mission Statement</FieldLabel>
        <Textarea value={formData.mission_statement || ''} onChange={(e) => handleChange('mission_statement', e.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Describe your school's mission" className={isAI('mission_statement') ? 'bg-blue-50 border-blue-200' : ''} />
      </div>
      <div>
        <Label>Website</Label>
        <Input value={formData.website || ''} onChange={(e) => handleChange('website', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label>Living Arrangements</Label>
        <div className="flex gap-4 mt-2">
          {['Day', 'Boarding'].map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(formData.living_arrangements || []).includes(opt)}
                onChange={(e) => {
                  const current = formData.living_arrangements || [];
                  const updated = e.target.checked ? [...current, opt] : current.filter(v => v !== opt);
                  handleChange('living_arrangements', updated);
                }}
                className="rounded border-slate-300"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      </div>
      {(formData.living_arrangements || []).includes('Boarding') && (
        <div className="pl-4 border-l-2 border-teal-200 space-y-4">
          <div>
            <Label>Boarding Type</Label>
            <Select value={formData.boarding_type || ''} onValueChange={(val) => handleChange('boarding_type', val)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Boarding</SelectItem>
                <SelectItem value="weekly">Weekly Boarding</SelectItem>
                <SelectItem value="flexible">Flexible (5-day)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Boarding Tuition (Annual)</Label>
            <Input type="number" value={formData.boarding_tuition || ''} onChange={(e) => handleChange('boarding_tuition', parseFloat(e.target.value))} placeholder="e.g. 45000" />
          </div>
        </div>
      )}
      <div>
        <Label>Religious Affiliation</Label>
        <Input value={formData.faith_based || ''} onChange={(e) => handleChange('faith_based', e.target.value)} placeholder="e.g. Non-denominational, Catholic" />
      </div>
      <TagInput label="Languages of Instruction" field="languagesOfInstruction" placeholder="e.g. English, French" formData={formData} onChange={handleChange} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Average Class Size</Label>
          <Input type="number" value={formData.avg_class_size || ''} onChange={(e) => handleChange('avg_class_size', parseInt(e.target.value))} />
        </div>
        <div>
          <Label>Student-Teacher Ratio</Label>
          <Input value={formData.student_teacher_ratio || ''} onChange={(e) => handleChange('student_teacher_ratio', e.target.value)} placeholder="e.g. 12:1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Founded</Label>
          <Input type="number" value={formData.founded || ''} onChange={(e) => handleChange('founded', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 1985" />
        </div>
        <div>
          <Label>Total Enrollment</Label>
          <Input type="number" value={formData.enrollment || ''} onChange={(e) => handleChange('enrollment', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 450" />
        </div>
      </div>
      <div>
        <Label>Virtual Tour URL</Label>
        <Input value={formData.virtual_tour_url || ''} onChange={(e) => handleChange('virtual_tour_url', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label>Campus Feel</Label>
        <Select value={formData.campus_feel || ''} onValueChange={(val) => handleChange('campus_feel', val)}>
          <SelectTrigger><SelectValue placeholder="Select feel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Warm and nurturing">Warm and nurturing</SelectItem>
            <SelectItem value="Rigorous and structured">Rigorous and structured</SelectItem>
            <SelectItem value="Progressive and creative">Progressive and creative</SelectItem>
            <SelectItem value="Traditional and formal">Traditional and formal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between py-2">
        <Label>Financial Aid Available</Label>
        <Switch checked={formData.financial_aid_available || false} onCheckedChange={(val) => handleChange('financial_aid_available', val)} />
      </div>
    </div>
  );

  // ==========================================================================
  // Tier 3 fields
  // ==========================================================================
  const tier3Content = (
    <div className="space-y-4">
      <TagInput label="Arts Programs" field="artsPrograms" placeholder="Add arts program" formData={formData} onChange={handleChange} />
      <TagInput label="Sports Programs" field="sportsPrograms" placeholder="Add sports program" formData={formData} onChange={handleChange} />
      <TagInput label="Clubs & Activities" field="clubs" placeholder="Add club" formData={formData} onChange={handleChange} />
      <TagInput label="Facilities" field="facilities" placeholder="e.g. Pool, Theatre, Lab" formData={formData} onChange={handleChange} />
      <TagInput label="Special Education Programs" field="specialEdPrograms" placeholder="Add program" formData={formData} onChange={handleChange} />
      <TagInput label="Curriculum Type" field="curriculum" placeholder="e.g. IB, Montessori, AP" formData={formData} onChange={handleChange} />
      <TagInput label="Accreditations" field="accreditations" placeholder="Add accreditation" formData={formData} onChange={handleChange} />
      <TagInput label="Specializations" field="specializations" placeholder="e.g. STEM, French Immersion, Gifted" formData={formData} onChange={handleChange} />
      <TagInput label="School Values" field="values" placeholder="e.g. Integrity, Excellence, Diversity" formData={formData} onChange={handleChange} />
      <div>
        <Label>Teaching Philosophy</Label>
        <Textarea value={formData.teaching_philosophy || ''} onChange={(e) => handleChange('teaching_philosophy', e.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Describe your teaching approach" />
      </div>
      <div>
        <Label>Highlights (3 sentences, 150 chars each)</Label>
        <div className="space-y-2 mt-2">
          {[0, 1, 2].map((idx) => (
            <Input
              key={idx}
              value={formData.highlights?.[idx] || ''}
              onChange={(e) => {
                const highlights = [...(formData.highlights || ['', '', ''])];
                highlights[idx] = e.target.value.slice(0, 150);
                handleChange('highlights', highlights);
              }}
              placeholder={`Highlight ${idx + 1}`}
              maxLength={150}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const tierContents = [tier1Content, tier2Content, tier3Content];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-5">
          <CompletenessRing score={weightedScore} />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Profile Editor</h2>
            <p className="text-slate-600 text-sm mt-0.5">Complete each tier to improve your school's visibility and match rate.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {autoSaved && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved</span>
            </div>
          )}
          <a href={`/school?id=${school.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline"><Eye className="h-4 w-4 mr-2" />Preview</Button>
          </a>
          <div className="relative group">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className={`${showTier1Warning ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : 'bg-teal-600 hover:bg-teal-700'}`}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            {showTier1Warning && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 text-center">
                Complete all required fields to save
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier 1 Warning Banner */}
      {showTier1Warning && (
        <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {tier1Total - tier1Filled} required field{tier1Total - tier1Filled !== 1 ? 's' : ''} still missing
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Complete all Tier 1 fields to save and publish your profile.
            </p>
          </div>
        </div>
      )}

      {/* Tier Accordions */}
      <div className="space-y-4">
        {TIERS.map((tier, idx) => (
          <TierSection
            key={tier.id}
            tier={tier}
            filled={countFilled(formData, tier.fields, testimonialCount)}
            open={openTiers[tier.id]}
            onToggle={() => toggleTier(tier.id)}
          >
            {tierContents[idx]}
          </TierSection>
        ))}
      </div>
    </div>
  );
}
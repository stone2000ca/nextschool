import { useState, useRef, useCallback, useEffect } from 'react';
import { updateSchool } from '@/lib/api/schools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const TagInput = ({ value = [], onChange, placeholder = 'Add and press Enter' }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tag) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, idx) => (
          <div key={idx} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-sm">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  );
};

const FormSection = ({ title, children, defaultOpen = true }) => {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border rounded-lg">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <ChevronDown className="h-4 w-4 text-slate-600" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0 space-y-4 border-t">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function EditProfileForm({ school, onUpdate }) {
  const [formData, setFormData] = useState(school || {});
  const [savingField, setSavingField] = useState(null);
  const [savedField, setSavedField] = useState(null);
  const saveTimeouts = useRef({});

  useEffect(() => {
    setFormData(school || {});
  }, [school]);

  const autoSave = useCallback((field, value) => {
    setSavingField(field);
    clearTimeout(saveTimeouts.current[field]);

    saveTimeouts.current[field] = setTimeout(async () => {
      try {
        await updateSchool(school.id, { [field]: value });
        setSavingField(null);
        setSavedField(field);
        setTimeout(() => setSavedField(null), 2000);
        onUpdate && onUpdate(field, value);
      } catch (error) {
        console.error(`Failed to save ${field}:`, error);
        toast.error(`Failed to save changes`);
        setSavingField(null);
      }
    }, 1000);
  }, [school?.id, onUpdate]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    autoSave(field, value);
  };

  const handleTagChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    autoSave(field, value);
  };

  const getSaveIndicator = (field) => {
    if (savingField === field) {
      return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    }
    if (savedField === field) {
      return <Check className="h-4 w-4 text-green-600" />;
    }
    return null;
  };

  const FieldWrapper = ({ label, field, indicator = true, children }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {indicator && getSaveIndicator(field)}
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <FormSection title="Basic Info" defaultOpen={true}>
        <FieldWrapper label="School Name" field="name">
          <input
            type="text"
            value={formData.name || ''}
            disabled
            className="w-full px-3 py-2 border rounded-lg bg-slate-100 text-slate-500 text-sm"
          />
        </FieldWrapper>

        <FieldWrapper label="Address" field="address">
          <Input
            value={formData.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Street address"
          />
        </FieldWrapper>

        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label="City" field="city">
            <Input
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="City"
            />
          </FieldWrapper>
          <FieldWrapper label="Province/State" field="province_state">
            <Input
              value={formData.province_state || ''}
              onChange={(e) => handleChange('province_state', e.target.value)}
              placeholder="Province/State"
            />
          </FieldWrapper>
        </div>

        <FieldWrapper label="Country" field="country">
          <Input
            value={formData.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
            placeholder="Country"
          />
        </FieldWrapper>

        <FieldWrapper label="Phone" field="phone">
          <Input
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="Phone number"
          />
        </FieldWrapper>

        <FieldWrapper label="Email" field="email">
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="Email address"
          />
        </FieldWrapper>

        <FieldWrapper label="Website" field="website">
          <Input
            value={formData.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="https://example.com"
          />
        </FieldWrapper>

        <FieldWrapper label="Founded Year" field="founded">
          <Input
            type="number"
            value={formData.founded || ''}
            onChange={(e) => handleChange('founded', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Year"
          />
        </FieldWrapper>

        <FieldWrapper label="Total Enrollment" field="enrollment">
          <Input
            type="number"
            value={formData.enrollment || ''}
            onChange={(e) => handleChange('enrollment', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Number of students"
          />
        </FieldWrapper>

        <FieldWrapper label="Gender Policy" field="gender_policy">
          <select
            value={formData.gender_policy || ''}
            onChange={(e) => handleChange('gender_policy', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select...</option>
            <option value="Co-ed">Co-ed</option>
            <option value="All-Boys">All-Boys</option>
            <option value="All-Girls">All-Girls</option>
            <option value="Co-ed with single-gender classes">Co-ed with single-gender classes</option>
          </select>
        </FieldWrapper>

        <FieldWrapper label="Religious Affiliation" field="faithBased">
          <Input
            value={formData.faithBased || ''}
            onChange={(e) => handleChange('faithBased', e.target.value)}
            placeholder="e.g., Catholic, Jewish, None"
          />
        </FieldWrapper>

        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label="Lowest Grade" field="lowestGrade">
            <Input
              type="number"
              value={formData.lowestGrade ?? ''}
              onChange={(e) => handleChange('lowestGrade', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="-2=PK, -1=JK, 0=K"
            />
          </FieldWrapper>
          <FieldWrapper label="Highest Grade" field="highestGrade">
            <Input
              type="number"
              value={formData.highestGrade ?? ''}
              onChange={(e) => handleChange('highestGrade', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 12"
            />
          </FieldWrapper>
        </div>

        <FieldWrapper label="School Type" field="schoolTypeLabel">
          <select
            value={formData.schoolTypeLabel || ''}
            onChange={(e) => handleChange('schoolTypeLabel', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select...</option>
            {['Independent', 'Montessori', 'Waldorf', 'International', 'Religious', 'Arts-Focused', 'STEM-Focused', 'Military', 'Special Needs', 'Online'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FieldWrapper>

        <FieldWrapper label="Living Arrangements" field="livingArrangements" indicator={false}>
          <div className="flex gap-4">
            {['Day', 'Boarding'].map(opt => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(formData.livingArrangements || []).includes(opt)}
                  onChange={(e) => {
                    const current = formData.livingArrangements || [];
                    const updated = e.target.checked ? [...current, opt] : current.filter(v => v !== opt);
                    handleChange('livingArrangements', updated);
                  }}
                  className="rounded"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>

        {(formData.livingArrangements || []).includes('Boarding') && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-teal-200">
            <FieldWrapper label="Boarding Type" field="boardingType">
              <select
                value={formData.boardingType || ''}
                onChange={(e) => handleChange('boardingType', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select...</option>
                <option value="full">Full Boarding</option>
                <option value="weekly">Weekly Boarding</option>
                <option value="flexible">Flexible (5-day)</option>
              </select>
            </FieldWrapper>
            <FieldWrapper label="Boarding Tuition (Annual)" field="boardingTuition">
              <Input
                type="number"
                value={formData.boardingTuition || ''}
                onChange={(e) => handleChange('boardingTuition', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="e.g. 45000"
              />
            </FieldWrapper>
          </div>
        )}
      </FormSection>

      {/* About */}
      <FormSection title="About">
        <FieldWrapper label="Mission Statement (500 chars max)" field="missionStatement">
          <Textarea
            value={formData.missionStatement || ''}
            onChange={(e) => handleChange('missionStatement', e.target.value.slice(0, 500))}
            placeholder="Describe your school's mission"
            maxLength={500}
            rows={3}
          />
        </FieldWrapper>

        <FieldWrapper label="Teaching Philosophy (500 chars max)" field="teachingPhilosophy">
          <Textarea
            value={formData.teachingPhilosophy || ''}
            onChange={(e) => handleChange('teachingPhilosophy', e.target.value.slice(0, 500))}
            placeholder="Describe your teaching approach"
            maxLength={500}
            rows={3}
          />
        </FieldWrapper>

        <FieldWrapper label="Highlights (3 sentences, 150 chars each)" field="highlights">
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <Input
                key={idx}
                value={formData.highlights?.[idx] || ''}
                onChange={(e) => {
                  const highlights = [...(formData.highlights || ['', '', ''])];
                  highlights[idx] = e.target.value.slice(0, 150);
                  handleTagChange('highlights', highlights);
                }}
                placeholder={`Highlight ${idx + 1} (150 chars)`}
                maxLength={150}
              />
            ))}
          </div>
        </FieldWrapper>

        <FieldWrapper label="Campus Feel" field="campusFeel">
          <select
            value={formData.campusFeel || ''}
            onChange={(e) => handleChange('campusFeel', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select...</option>
            <option value="Warm and nurturing">Warm and nurturing</option>
            <option value="Rigorous and structured">Rigorous and structured</option>
            <option value="Progressive and creative">Progressive and creative</option>
            <option value="Traditional and formal">Traditional and formal</option>
          </select>
        </FieldWrapper>

        <FieldWrapper label="School Values" field="values">
          <TagInput
            value={formData.values || []}
            onChange={(value) => handleTagChange('values', value)}
            placeholder="e.g., Integrity, Excellence, Diversity"
          />
        </FieldWrapper>
      </FormSection>

      {/* Academics */}
      <FormSection title="Academics">
        <FieldWrapper label="Curriculum Type" field="curriculum">
          <TagInput
            value={Array.isArray(formData.curriculum) ? formData.curriculum : (formData.curriculum ? [formData.curriculum] : [])}
            onChange={(value) => handleTagChange('curriculum', value)}
            placeholder="e.g. IB, Montessori, AP"
          />
        </FieldWrapper>

        <FieldWrapper label="Average Class Size" field="avgClassSize">
          <Input
            type="number"
            value={formData.avgClassSize || ''}
            onChange={(e) => handleChange('avgClassSize', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g., 20"
          />
        </FieldWrapper>

        <FieldWrapper label="Student-Teacher Ratio" field="studentTeacherRatio">
          <Input
            value={formData.studentTeacherRatio || ''}
            onChange={(e) => handleChange('studentTeacherRatio', e.target.value)}
            placeholder="e.g., 1:10"
          />
        </FieldWrapper>

        <FieldWrapper label="Languages of Instruction" field="languagesOfInstruction">
          <TagInput
            value={formData.languagesOfInstruction || []}
            onChange={(value) => handleTagChange('languagesOfInstruction', value)}
            placeholder="e.g., English, French, Mandarin"
          />
        </FieldWrapper>

        <FieldWrapper label="Accreditations" field="accreditations">
          <TagInput
            value={formData.accreditations || []}
            onChange={(value) => handleTagChange('accreditations', value)}
            placeholder="e.g., WASC, IB World School"
          />
        </FieldWrapper>
      </FormSection>

      {/* Programs */}
      <FormSection title="Programs">
        <FieldWrapper label="Arts Programs" field="artsPrograms">
          <TagInput
            value={formData.artsPrograms || []}
            onChange={(value) => handleTagChange('artsPrograms', value)}
            placeholder="e.g., Music, Theater, Visual Arts"
          />
        </FieldWrapper>

        <FieldWrapper label="Sports Programs" field="sportsPrograms">
          <TagInput
            value={formData.sportsPrograms || []}
            onChange={(value) => handleTagChange('sportsPrograms', value)}
            placeholder="e.g., Basketball, Soccer, Tennis"
          />
        </FieldWrapper>

        <FieldWrapper label="Clubs & Organizations" field="clubs">
          <TagInput
            value={formData.clubs || []}
            onChange={(value) => handleTagChange('clubs', value)}
            placeholder="e.g., Debate Team, Robotics, Student Government"
          />
        </FieldWrapper>

        <FieldWrapper label="Special Education Programs" field="specialEdPrograms">
          <TagInput
            value={formData.specialEdPrograms || []}
            onChange={(value) => handleTagChange('specialEdPrograms', value)}
            placeholder="e.g., Learning Support, ESL"
          />
        </FieldWrapper>

        <FieldWrapper label="Specializations" field="specializations">
          <TagInput
            value={formData.specializations || []}
            onChange={(value) => handleTagChange('specializations', value)}
            placeholder="e.g., STEM, French Immersion, Gifted"
          />
        </FieldWrapper>
      </FormSection>

      {/* Tuition & Aid */}
      <FormSection title="Tuition & Financial Aid">
        <div className="grid grid-cols-3 gap-4">
          <FieldWrapper label="Day Tuition (Annual)" field="dayTuition">
            <Input
              type="number"
              value={formData.dayTuition || ''}
              onChange={(e) => handleChange('dayTuition', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 25000"
            />
          </FieldWrapper>
          <FieldWrapper label="Currency" field="currency">
            <select
              value={formData.currency || ''}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select...</option>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </FieldWrapper>
          <FieldWrapper label="Financial Aid Available" field="financialAidAvailable" indicator={false}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.financialAidAvailable || false}
                onChange={(e) => handleChange('financialAidAvailable', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Yes</span>
            </label>
          </FieldWrapper>
        </div>
      </FormSection>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdmissionsSection({ school, onUpdate }) {
  const [formData, setFormData] = useState({
    dayAdmissionDeadline: school?.dayAdmissionDeadline || '',
    rolling: false,
    openHouseDates: school?.openHouseDates || [],
    admissionRequirements: school?.admissionRequirements || [],
    acceptanceRate: school?.acceptanceRate || '',
    admission_contact: {
      name: '',
      role: '',
      email: '',
      phone: ''
    }
  });

  const [savingField, setSavingField] = useState(null);
  const [showNewHouseDate, setShowNewHouseDate] = useState(false);
  const [newHouseDate, setNewHouseDate] = useState({ date: '', title: '' });

  const requirements = [
    { id: 'ssat', label: 'SSAT/ISEE scores' },
    { id: 'student_interview', label: 'Student interview' },
    { id: 'parent_interview', label: 'Parent interview' },
    { id: 'shadow_day', label: 'School visit/shadow day' },
    { id: 'transcripts', label: 'Academic transcripts' },
    { id: 'teacher_refs', label: 'Teacher references' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'entrance_exam', label: 'Entrance exam' },
    { id: 'other', label: 'Other' }
  ];

  const saveField = async (field, value) => {
    setSavingField(field);
    try {
      const updateData = { [field]: value };
      await base44.entities.School.update(school.id, updateData);
      onUpdate && onUpdate(field, value);
      setTimeout(() => setSavingField(null), 1500);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save changes');
      setSavingField(null);
    }
  };

  const toggleRequirement = async (reqId) => {
    const updated = formData.admissionRequirements.includes(reqId)
      ? formData.admissionRequirements.filter(r => r !== reqId)
      : [...formData.admissionRequirements, reqId];
    setFormData({ ...formData, admissionRequirements: updated });
    await saveField('admissionRequirements', updated);
  };

  const addOpenHouseDate = async () => {
    if (!newHouseDate.date || !newHouseDate.title) {
      toast.error('Please enter both date and title');
      return;
    }
    const updated = [...formData.openHouseDates, `${newHouseDate.date} - ${newHouseDate.title}`];
    setFormData({ ...formData, openHouseDates: updated });
    await saveField('openHouseDates', updated);
    setNewHouseDate({ date: '', title: '' });
    setShowNewHouseDate(false);
  };

  const removeOpenHouseDate = async (idx) => {
    const updated = formData.openHouseDates.filter((_, i) => i !== idx);
    setFormData({ ...formData, openHouseDates: updated });
    await saveField('openHouseDates', updated);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Application Deadline */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Application Deadline</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Deadline Date</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.dayAdmissionDeadline}
                onChange={(e) => setFormData({ ...formData, dayAdmissionDeadline: e.target.value })}
                onBlur={(e) => saveField('dayAdmissionDeadline', e.target.value)}
              />
              {savingField === 'dayAdmissionDeadline' && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400 my-auto" />
              )}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.rolling}
              onChange={(e) => {
                setFormData({ ...formData, rolling: e.target.checked });
                if (e.target.checked) {
                  saveField('dayAdmissionDeadline', '');
                }
              }}
              className="rounded"
            />
            <span className="text-sm font-medium">Rolling admissions</span>
          </label>
        </div>
      </div>

      {/* Open House Dates */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Open House Dates</h3>
        <div className="space-y-3 mb-4">
          {formData.openHouseDates.map((dateStr, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">{dateStr}</span>
              <button
                onClick={() => removeOpenHouseDate(idx)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {!showNewHouseDate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewHouseDate(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Another
          </Button>
        ) : (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <Input
              type="date"
              value={newHouseDate.date}
              onChange={(e) => setNewHouseDate({ ...newHouseDate, date: e.target.value })}
              placeholder="Date"
            />
            <Input
              value={newHouseDate.title}
              onChange={(e) => setNewHouseDate({ ...newHouseDate, title: e.target.value })}
              placeholder="Event title (e.g., Fall Open House)"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addOpenHouseDate} className="bg-teal-600 hover:bg-teal-700">
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewHouseDate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Entrance Requirements */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Entrance Requirements</h3>
        <div className="space-y-2">
          {requirements.map((req) => (
            <label key={req.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
              <input
                type="checkbox"
                checked={formData.admissionRequirements.includes(req.id)}
                onChange={() => toggleRequirement(req.id)}
                className="rounded"
              />
              <span className="text-sm">{req.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Acceptance Rate */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Acceptance Rate (optional)</label>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.acceptanceRate}
            onChange={(e) => setFormData({ ...formData, acceptanceRate: e.target.value })}
            onBlur={(e) => saveField('acceptanceRate', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g., 25"
          />
          <span className="flex items-center text-slate-600">%</span>
          {savingField === 'acceptanceRate' && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>
      </div>

      {/* Admissions Contact */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Admissions Contact (optional)</h3>
        <div className="space-y-3">
          <Input
            value={formData.admission_contact.name}
            onChange={(e) => setFormData({ ...formData, admission_contact: { ...formData.admission_contact, name: e.target.value } })}
            placeholder="Contact name"
          />
          <Input
            value={formData.admission_contact.role}
            onChange={(e) => setFormData({ ...formData, admission_contact: { ...formData.admission_contact, role: e.target.value } })}
            placeholder="Role (e.g., Director of Admissions)"
          />
          <Input
            type="email"
            value={formData.admission_contact.email}
            onChange={(e) => setFormData({ ...formData, admission_contact: { ...formData.admission_contact, email: e.target.value } })}
            placeholder="Email"
          />
          <Input
            value={formData.admission_contact.phone}
            onChange={(e) => setFormData({ ...formData, admission_contact: { ...formData.admission_contact, phone: e.target.value } })}
            placeholder="Phone"
          />
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ChatSession {
  id: string;
  child_name?: string | null;
  child_grade?: number | null;
  location_area?: string | null;
  max_tuition?: number | null;
  priorities?: string[] | null;
  learning_differences?: string[] | null;
}

interface EditProfilePanelProps {
  session: ChatSession;
  onSave: (sessionId: string, data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

function ChipInput({
  chips,
  onChange,
  placeholder,
}: {
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addChip = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onChange([...chips, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.endsWith(',')) {
      addChip(val.slice(0, -1));
    } else {
      setInputValue(val);
    }
  };

  return (
    <div className="w-full min-h-[42px] flex flex-wrap gap-1.5 px-2 py-1.5 bg-white/10 border border-white/20 rounded focus-within:border-teal-500/50 transition-colors">
      {chips.map((chip, idx) => (
        <span
          key={idx}
          className="flex items-center gap-1 bg-teal-900/50 text-teal-300 rounded-full px-3 py-1 text-sm"
        >
          {chip}
          <button
            type="button"
            onClick={() => onChange(chips.filter((_, i) => i !== idx))}
            className="ml-0.5 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={chips.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-white text-sm outline-none placeholder:text-white/40"
      />
    </div>
  );
}

export default function EditProfilePanel({ session, onSave, onClose }: EditProfilePanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({
    childGrade: session.child_grade ?? null as number | null,
    maxTuition: session.max_tuition ?? null as number | null,
    locationArea: session.location_area ?? '',
    priorities: session.priorities || [] as string[],
    learningDifferences: session.learning_differences || [] as string[],
  });

  const handleClose = useCallback(() => {
    if (!isSaving) onClose();
  }, [isSaving, onClose]);

  // Escape key closes the panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(session.id, {
        child_grade: editData.childGrade,
        max_tuition: editData.maxTuition,
        location_area: editData.locationArea || null,
        priorities: editData.priorities,
        learning_differences: editData.learningDifferences,
      });
    } catch (err) {
      console.error('Failed to save profile edits:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const childName = session.child_name || 'Student';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Panel */}
      <div
        className="relative w-[420px] max-sm:w-full h-full flex flex-col"
        style={{
          animation: 'slideInFromRight 200ms ease-out',
          background: '#22222E',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">{childName}</h2>
            <p className="text-sm text-white/50">Edit Profile</p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Grade */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Grade</label>
            <select
              value={editData.childGrade ?? ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  childGrade: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm appearance-none cursor-pointer"
            >
              <option value="">Select Grade</option>
              <option value="-2">PK (Pre-Kindergarten)</option>
              <option value="-1">JK (Junior Kindergarten)</option>
              <option value="0">SK (Senior Kindergarten)</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{`Grade ${i + 1}`}</option>
              ))}
            </select>
          </div>

          {/* Budget Slider */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Budget</label>
            <input
              type="range"
              min="5000"
              max="100000"
              step="5000"
              value={editData.maxTuition || 30000}
              onChange={(e) =>
                setEditData({ ...editData, maxTuition: parseInt(e.target.value) })
              }
              className="w-full accent-teal-500"
            />
            <div className="text-sm text-teal-400 mt-1">
              ${((editData.maxTuition || 30000) / 1000).toFixed(0)}K/year
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Location</label>
            <input
              type="text"
              value={editData.locationArea}
              onChange={(e) =>
                setEditData({ ...editData, locationArea: e.target.value })
              }
              placeholder="City or region"
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40"
            />
          </div>

          {/* Priorities */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Priorities</label>
            <ChipInput
              chips={editData.priorities}
              onChange={(chips) => setEditData({ ...editData, priorities: chips })}
              placeholder="Type a priority and press Enter"
            />
          </div>

          {/* Learning Differences */}
          <div>
            <label className="text-sm text-white/60 mb-2 block">Learning Differences</label>
            <ChipInput
              chips={
                Array.isArray(editData.learningDifferences)
                  ? editData.learningDifferences
                  : []
              }
              onChange={(chips) =>
                setEditData({ ...editData, learningDifferences: chips })
              }
              placeholder="Type and press Enter"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

    </div>
  );
}

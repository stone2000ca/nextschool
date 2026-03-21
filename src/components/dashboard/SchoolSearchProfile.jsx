import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSession } from '@/lib/api/sessions';
import { Button } from '@/components/ui/button';
import UpgradePaywallModal from '@/components/dialogs/UpgradePaywallModal';
import { CheckCircle, Copy } from 'lucide-react';
import {
  Edit2,
  Share2,
  Archive,
  Palette,
  BookOpen,
  Heart,
  Microscope,
  Music,
  Trophy,
  Globe,
  X,
} from 'lucide-react';

const PRIORITY_ICONS = {
  Arts: Palette,
  Academics: BookOpen,
  Nurturing: Heart,
  'STEM': Microscope,
  'Sports': Trophy,
  'Music': Music,
  'Languages': Globe,
};

function ChipInput({ chips, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const addChip = (value) => {
    const trimmed = value.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onChange([...chips, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  const handleChange = (e) => {
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
        <span key={idx} className="flex items-center gap-1 bg-teal-900/50 text-teal-300 rounded-full px-3 py-1 text-sm">
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

export default function SchoolSearchProfile({
  session,
  shortlistCount = 0,
  onViewMatches,
  onEditProfile,
  onArchive,
  isPaid = false,
}) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showShareUpgrade, setShowShareUpgrade] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [editData, setEditData] = useState({
    childGrade: session.child_grade,
    maxTuition: session.max_tuition,
    locationArea: session.location_area,
    priorities: session.priorities || [],
    learningDifferences: session.learning_differences || [],
  });

  const handleViewMatches = () => {
    const target = session.id
      ? `/consultant?sessionId=${session.id}`
      : '/consultant';
    router.push(target);
    if (onViewMatches) onViewMatches(session);
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await updateSession(session.id, { status: 'archived' });
      if (onArchive) onArchive();
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      // Update ONLY the editable session fields — never touch familyBrief or FamilyProfile
      const sessionUpdate = {
        child_grade: editData.childGrade ?? null,
        max_tuition: editData.maxTuition ?? null,
        location_area: editData.locationArea ?? null,
        priorities: editData.priorities,
        learning_differences: editData.learningDifferences,
      };
      await updateSession(session.id, sessionUpdate);

      setIsEditMode(false);
      if (onArchive) onArchive(); // Trigger refresh
    } catch (err) {
      console.error('Failed to save edits:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      // Generate UUID for shareToken
      const shareToken = crypto.randomUUID();
      await updateSession(session.id, { share_token: shareToken });
      const url = `https://nextschool.ca/SharedProfile?token=${shareToken}`;
      setShareUrl(url);
      setShowShareModal(true);
    } catch (err) {
      console.error('Failed to generate share link:', err);
    }
  };

  const handleCopyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  const handleRemoveSharing = async () => {
    try {
      await updateSession(session.id, { share_token: null });
      setShowShareModal(false);
      setShareUrl(null);
    } catch (err) {
      console.error('Failed to remove sharing:', err);
    }
  };

  const isActive = session.status === 'active';
  const statusColor = isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-500/20 text-slate-300';

  // Parse matchedSchools
  let matchedCount = 0;
  let matchedSchools = [];
  try {
    if (session.matched_schools && typeof session.matched_schools === 'string') {
      matchedSchools = JSON.parse(session.matched_schools);
      matchedCount = Array.isArray(matchedSchools) ? matchedSchools.length : 0;
    }
  } catch (e) {
    matchedCount = 0;
  }

  // Get child initial for avatar
  const initial = session.child_name ? session.child_name.charAt(0).toUpperCase() : '?';

  // Prioritize tags (if priorities exist)
  const priorities = session.priorities || [];

  // Format budget range
  const budgetRange = session.max_tuition
    ? `$${(session.max_tuition / 1000).toFixed(0)}K`
    : 'Not set';

  // Best match school (first in matched)
  const bestMatchSchool = matchedSchools[0];

  return (
    <div
      className="relative w-[240px] min-w-[240px] max-w-[240px] bg-[#2A2A3E] border border-white/5 rounded-xl flex flex-col hover:shadow-lg hover:border-teal-500/20 transition-all duration-200 overflow-hidden"
    >
      {!isEditMode ? (
        <>
          {/* Archive icon — top right */}
          <button
            onClick={(e) => { e.stopPropagation(); handleArchive(); }}
            disabled={isArchiving}
            title="Archive Profile"
            className="absolute top-2.5 right-2.5 text-white/30 hover:text-white/70 transition-colors disabled:opacity-30 z-10"
          >
            <Archive className="w-4 h-4" />
          </button>

          {/* HEADER */}
          <div className="p-3 pb-0 flex items-center gap-2 min-w-0 pr-8">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initial}
            </div>
            <span className="font-semibold text-white text-sm truncate">{session.child_name || 'Student'}</span>
          </div>

          {/* META */}
          <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
            {session.child_grade != null && (
              <span className="text-xs bg-white/10 rounded-full px-2 py-0.5 text-gray-300">
                Grade {session.child_grade}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-teal-400' : 'bg-gray-500'}`} />
              {isActive ? 'Active' : 'Paused'}
            </span>
          </div>

          {/* PRIORITIES */}
          {priorities.length > 0 && (
            <div className="px-3 pt-3">
              <p className="text-xs text-gray-500 mb-1.5">Looking for:</p>
              <div className="flex flex-wrap gap-1">
                {priorities.slice(0, 3).map((p, idx) => (
                  <span key={idx} className="text-xs bg-teal-900/50 text-teal-300 rounded-full px-2 py-0.5">{p}</span>
                ))}
                {priorities.length > 3 && (
                  <span className="text-xs bg-white/5 text-white/40 rounded-full px-2 py-0.5">+{priorities.length - 3}</span>
                )}
              </div>
            </div>
          )}

          {/* MATCH COUNT */}
          <div className="px-3 pt-3">
            <p className="text-sm">
              <span className="text-teal-400 font-semibold">{matchedCount}</span>
              <span className="text-white/50"> matches</span>
              {shortlistCount > 0 && (
                <>
                  <span className="text-white/30"> · </span>
                  <span className="text-teal-400 font-semibold">{shortlistCount}</span>
                  <span className="text-white/50"> shortlisted</span>
                </>
              )}
            </p>
          </div>

          {/* ACTION ROW */}
          <div className="p-3 mt-auto pt-4 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleViewMatches}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              View Matches
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEditProfile ? onEditProfile(session) : setIsEditMode(true); }}
              title="Edit Profile"
              className="w-9 h-9 flex items-center justify-center border border-white/10 rounded-lg bg-transparent text-white/50 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); isPaid ? handleShare() : setShowShareUpgrade(true); }}
              title="Share Profile"
              className="w-9 h-9 flex items-center justify-center border border-white/10 rounded-lg bg-transparent text-white/50 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        /* Edit Mode — full card replaced */
        <div className="p-4 bg-white/5 space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* Grade */}
          <div>
            <label className="text-xs text-white/60 mb-2 block">Grade</label>
            <select
              value={editData.childGrade || ''}
              onChange={(e) => setEditData({ ...editData, childGrade: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm text-gray-900"
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
            <label className="text-xs text-white/60 mb-2 block">Budget</label>
            <input
              type="range"
              min="5000"
              max="100000"
              step="5000"
              value={editData.maxTuition || 30000}
              onChange={(e) => setEditData({ ...editData, maxTuition: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="text-sm text-teal-400 mt-1">
              ${(editData.maxTuition / 1000 || 30).toFixed(0)}K/year
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-white/60 mb-2 block">Location</label>
            <input
              type="text"
              value={editData.locationArea || ''}
              onChange={(e) => setEditData({ ...editData, locationArea: e.target.value })}
              placeholder="City or region"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm placeholder:text-white/40"
            />
          </div>

          {/* Priorities */}
          <div>
            <label className="text-xs text-white/60 mb-2 block">Priorities</label>
            <ChipInput
              chips={editData.priorities}
              onChange={(chips) => setEditData({ ...editData, priorities: chips })}
              placeholder="Type a priority and press Enter"
            />
          </div>

          {/* Special Needs */}
          <div>
            <label className="text-xs text-white/60 mb-2 block">Special Needs</label>
            <ChipInput
              chips={Array.isArray(editData.learningDifferences) ? editData.learningDifferences : (editData.learningDifferences ? editData.learningDifferences.split(',').map(s => s.trim()).filter(Boolean) : [])}
              onChange={(chips) => setEditData({ ...editData, learningDifferences: chips })}
              placeholder="Type and press Enter"
            />
          </div>

          {/* Save/Cancel */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleSaveEdits}
              disabled={isSaving}
              className="flex-1 min-w-0 bg-teal-600 hover:bg-teal-700 text-white text-sm"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              onClick={() => {
                setIsEditMode(false);
                setEditData({
                  childGrade: session.child_grade,
                  maxTuition: session.max_tuition,
                  locationArea: session.location_area,
                  priorities: session.priorities || [],
                  learningDifferences: session.learning_differences || [],
                });
              }}
              disabled={isSaving}
              variant="secondary"
              className="flex-1 min-w-0 text-sm"
            >
              Cancel Edit
            </Button>
          </div>
        </div>
      )}

      {/* WC12: Share Upgrade Modal */}
      <UpgradePaywallModal
        isOpen={showShareUpgrade}
        variant="SHARE"
        onClose={() => setShowShareUpgrade(false)}
      />

      {/* WC13: Share Modal for Paid Users */}
      {showShareModal && shareUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">Share This Profile</h2>
            <p className="text-white/70 mb-6">Send this link to your partner or anyone you want to collaborate with.</p>
            
            {/* URL Display */}
            <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-6 break-all">
              <p className="text-sm text-white/90 font-mono">{shareUrl}</p>
            </div>

            {/* Copy Button */}
            <Button
              onClick={handleCopyUrl}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2 mb-3"
            >
              {copiedToClipboard ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </Button>

            {/* Remove Sharing Button */}
            <Button
              onClick={handleRemoveSharing}
              variant="secondary"
              className="w-full gap-2"
            >
              <X className="w-4 h-4" />
              Revoke Access
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
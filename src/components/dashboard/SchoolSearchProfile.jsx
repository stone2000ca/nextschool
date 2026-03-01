import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  DollarSign,
  Calendar,
  Navigation,
  Zap,
  Eye,
  Edit,
  Share2,
  Archive,
  Palette,
  BookOpen,
  Heart,
  Microscope,
  Music,
  Trophy,
  Globe,
  MoreVertical,
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

export default function SchoolSearchProfile({
  session,
  onViewMatches,
  onEditProfile,
  onArchive,
  isPaid = false,
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleViewMatches = () => {
    navigate(createPageUrl('Consultant') + '?sessionId=' + session.id);
    if (onViewMatches) onViewMatches(session);
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await base44.entities.ChatSession.update(session.id, { status: 'archived' });
      setShowMenu(false);
      if (onArchive) onArchive();
    } catch (err) {
      console.error('Failed to archive session:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const isActive = session.status === 'active';
  const statusColor = isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-500/20 text-slate-300';

  // Parse matchedSchools
  let matchedCount = 0;
  let matchedSchools = [];
  try {
    if (session.matchedSchools && typeof session.matchedSchools === 'string') {
      matchedSchools = JSON.parse(session.matchedSchools);
      matchedCount = Array.isArray(matchedSchools) ? matchedSchools.length : 0;
    }
  } catch (e) {
    matchedCount = 0;
  }

  // Get child initial for avatar
  const initial = session.childName ? session.childName.charAt(0).toUpperCase() : '?';

  // Prioritize tags (if priorities exist)
  const priorities = session.priorities || [];

  // Format budget range
  const budgetRange = session.maxTuition
    ? `$${(session.maxTuition / 1000).toFixed(0)}K`
    : 'Not set';

  // Best match school (first in matched)
  const bestMatchSchool = matchedSchools[0];

  return (
    <div className="bg-gradient-to-br from-[#1E1E2E] to-[#2A2A3D] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-200 hover:shadow-xl flex flex-col group">
      {/* Header */}
      <div className="p-5 border-b border-white/10 bg-white/5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center font-bold text-white text-lg flex-shrink-0">
              {initial}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {session.childName || 'Student'}
              </h2>
              {session.childGrade != null && (
                <p className="text-sm text-white/60">Grade {session.childGrade}</p>
              )}
            </div>
          </div>

          {/* Status + Menu */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor}`}>
              {isActive ? 'Active' : 'Archived'}
            </div>
            {isActive && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-white/60" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-1 bg-[#1E1E2E] border border-white/20 rounded-lg shadow-lg z-10">
                    <button
                      onClick={handleArchive}
                      disabled={isArchiving}
                      className="w-full px-4 py-2 flex items-center gap-2 text-sm text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Archive className="w-4 h-4" />
                      {isArchiving ? 'Archiving...' : 'Archive'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Priority Tags */}
        {priorities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {priorities.slice(0, 4).map((priority, idx) => {
              const IconComponent = PRIORITY_ICONS[priority] || Zap;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full"
                >
                  <IconComponent className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-medium text-white/80">{priority}</span>
                </div>
              );
            })}
            {priorities.length > 4 && (
              <div className="flex items-center px-3 py-1.5 text-xs text-white/50">
                +{priorities.length - 4} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Key Data Grid */}
      <div className="p-5 border-b border-white/10 grid grid-cols-2 gap-3">
        {/* Location */}
        {session.locationArea && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Location</p>
              <p className="text-sm font-medium text-white/90">{session.locationArea}</p>
            </div>
          </div>
        )}

        {/* Budget */}
        {session.maxTuition && (
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Budget</p>
              <p className="text-sm font-medium text-white/90">{budgetRange}/year</p>
            </div>
          </div>
        )}

        {/* Grade */}
        {session.childGrade != null && (
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Grade</p>
              <p className="text-sm font-medium text-white/90">Grade {session.childGrade}</p>
            </div>
          </div>
        )}

        {/* Commute Preference */}
        {session.commuteToleranceMinutes && (
          <div className="flex items-start gap-2">
            <Navigation className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Commute</p>
              <p className="text-sm font-medium text-white/90">{session.commuteToleranceMinutes} min</p>
            </div>
          </div>
        )}

        {/* Special Needs */}
        {session.learningDifferences && session.learningDifferences.length > 0 && (
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Special Needs</p>
              <p className="text-sm font-medium text-white/90">
                {session.learningDifferences[0]}
              </p>
            </div>
          </div>
        )}

        {/* Boarding Preference */}
        {session.boardingPreference && (
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/60">Boarding</p>
              <p className="text-sm font-medium text-white/90 capitalize">
                {session.boardingPreference.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Narrative */}
      {session.aiNarrative && (
        <div className="p-5 border-b border-white/10">
          <p className="text-sm text-white/75 leading-relaxed">
            {session.aiNarrative}
          </p>
        </div>
      )}

      {/* Match Summary */}
      <div className="p-5 border-b border-white/10 bg-white/5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Schools Matched</span>
            <span className="text-lg font-bold text-teal-400">{matchedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Shortlisted</span>
            <span className="text-lg font-bold text-teal-400">{session.shortlistedCount || 0}</span>
          </div>
          {bestMatchSchool && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50 mb-1">Best Match</p>
              <p className="text-sm font-semibold text-teal-300">{bestMatchSchool}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 flex gap-2 flex-wrap">
        <Button
          onClick={handleViewMatches}
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-2 text-sm"
        >
          <Eye className="w-4 h-4" />
          View Matches
        </Button>
        <Button
          onClick={onEditProfile}
          variant="outline"
          className="flex-1 border-white/20 text-white hover:bg-white/10 gap-2 text-sm"
        >
          <Edit className="w-4 h-4" />
          Edit
        </Button>
        {isPaid && (
          <Button
            variant="outline"
            className="flex-1 border-white/20 text-white hover:bg-white/10 gap-2 text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
    </div>
  );
}
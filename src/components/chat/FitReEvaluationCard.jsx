import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const DIRECTION_CONFIG = {
  improved: {
    banner: 'bg-emerald-500/20 border-emerald-500/30',
    icon: TrendingUp,
    color: 'text-emerald-400',
    label: 'Improved'
  },
  declined: {
    banner: 'bg-red-500/20 border-red-500/30',
    icon: TrendingDown,
    color: 'text-red-400',
    label: 'Declined'
  },
  unchanged: {
    banner: 'bg-slate-500/20 border-slate-500/30',
    icon: Minus,
    color: 'text-slate-400',
    label: 'Unchanged'
  }
};

const FIT_CONFIG = {
  strong_match: { label: 'Strong Match', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  good_match: { label: 'Good Match', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  worth_exploring: { label: 'Worth Exploring', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
};

export default function FitReEvaluationCard({ fitReEvaluation }) {
  if (!fitReEvaluation) return null;

  const { fitDirection, updatedFitLabel, visitVerdict, revisedStrengths = [], revisedConcerns = [] } = fitReEvaluation;

  const dirConfig = fitDirection ? DIRECTION_CONFIG[fitDirection] : null;
  const fitConfig = updatedFitLabel ? FIT_CONFIG[updatedFitLabel] : null;
  const DirectionIcon = dirConfig?.icon;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-[#1A1A2A] overflow-hidden text-sm">

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10 bg-white/5">
        <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-white">Post-Visit Re-Evaluation</span>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* Fit Direction Banner */}
        {dirConfig && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dirConfig.banner}`}>
            <DirectionIcon className={`h-4 w-4 ${dirConfig.color} flex-shrink-0`} />
            <span className={`text-sm font-semibold ${dirConfig.color}`}>{dirConfig.label}</span>
          </div>
        )}

        {/* Updated Fit Label */}
        {fitConfig && (
          <div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${fitConfig.bg} ${fitConfig.text} ${fitConfig.border}`}>
              {fitConfig.label}
            </span>
          </div>
        )}

        {/* Visit Verdict */}
        {visitVerdict && (
          <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10">
            <p className="text-xs text-white/70 italic leading-relaxed">{visitVerdict}</p>
          </div>
        )}

        {/* Revised Strengths */}
        {revisedStrengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths Confirmed</p>
            <div className="flex flex-wrap gap-2">
              {revisedStrengths.map((strength, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  {strength}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Revised Concerns */}
        {revisedConcerns.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Concerns Noted</p>
            <div className="flex flex-wrap gap-2">
              {revisedConcerns.map((concern, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
                  {concern}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
import { useState } from 'react';
import { Check, AlertCircle, X, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// =============================================================================
// E11b Phase 2: ComparisonMatrix
// Renders AI-generated structured comparison matrix with tradeoffs and narrative
// =============================================================================

function StatusIcon({ status }) {
  if (status === 'match') return <Check className="h-4 w-4 text-green-500 flex-shrink-0" />;
  if (status === 'mismatch') return <X className="h-4 w-4 text-red-500 flex-shrink-0" />;
  return <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
}

function getCellBgClass(status) {
  if (status === 'match') return 'bg-green-500/8';
  if (status === 'mismatch') return 'bg-red-500/8';
  return 'bg-yellow-500/8';
}

function getTruncatedNarrative(text, lines = 2) {
  if (!text) return '';
  const truncated = text.split('\n').slice(0, lines).join('\n');
  return truncated.length > 250 ? truncated.substring(0, 250) + '...' : truncated;
}

export default function ComparisonMatrix({ comparisonMatrix, familyProfile, isPremium, onUpgrade }) {
  const [narrativeExpanded, setNarrativeExpanded] = useState(false);

  if (!comparisonMatrix) return null;

  const { schools = [], dimensions = [], cells = {}, tradeOffs = [], narrative = '' } = comparisonMatrix;

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-white">
      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: `${schools.length * 160 + 140}px` }}>
          <colgroup>
            <col style={{ width: '140px' }} />
            {schools.map(s => <col key={s.id} style={{ width: '160px' }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-slate-600" />
              {schools.map(school => (
                <th key={school.id} className="p-3 text-center border-l border-slate-200">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 line-clamp-2">{school.name}</span>
                    {school.isVisited && (
                      <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Visited
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim, i) => (
              <tr key={dim.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                <td className="p-3 text-left text-xs font-medium text-slate-700 border-b border-slate-100 sticky left-0 z-[1] bg-inherit">
                  {dim.label}
                </td>
                {schools.map(school => {
                  const cell = cells[school.id]?.[dim.key];
                  if (!cell) return (
                    <td key={school.id} className="p-3 text-center border-b border-slate-100 border-l border-slate-200">
                      <span className="text-xs text-slate-400">—</span>
                    </td>
                  );

                  return (
                    <td
                      key={school.id}
                      className={`p-3 text-center border-b border-slate-100 border-l border-slate-200 ${getCellBgClass(cell.status)}`}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <StatusIcon status={cell.status} />
                        <span className="text-xs text-slate-700 leading-snug">{cell.value}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Tradeoffs */}
      {tradeOffs && tradeOffs.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">🔄 Key Tradeoffs</h3>
          <div className="space-y-2">
            {tradeOffs.map((tradeoff, idx) => {
              const school = schools.find(s => s.id === tradeoff.schoolId);
              return (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 text-sm">•</span>
                  <div className="flex-1">
                    {school && <span className="text-xs font-medium text-slate-700">{school.name}: </span>}
                    <span className="text-xs text-slate-600">{tradeoff.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary Accordion */}
      {narrative && (
        <Collapsible open={narrativeExpanded} onOpenChange={setNarrativeExpanded} className="border border-slate-200 rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">✨ AI Summary</h3>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${narrativeExpanded ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          {!narrativeExpanded && (
            <div className="px-4 py-2 bg-white text-xs text-slate-600 line-clamp-2 border-t border-slate-100 cursor-pointer hover:text-slate-700">
              {getTruncatedNarrative(narrative, 2)}
            </div>
          )}
          <CollapsibleContent className="p-4 bg-white border-t border-slate-100">
            <div className="prose prose-sm prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-wrap">
              {narrative}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
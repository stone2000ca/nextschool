import { X, Heart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatGrade(grade) {
  if (grade === null || grade === undefined) return '';
  const num = Number(grade);
  if (num <= -2) return 'PK';
  if (num === -1) return 'JK';
  if (num === 0) return 'K';
  return String(num);
}

function formatGradeRange(gradeFrom, gradeTo) {
  const from = formatGrade(gradeFrom);
  const to = formatGrade(gradeTo);
  if (!from && !to) return '';
  if (!from) return to;
  if (!to) return from;
  return `${from}-${to}`;
}

export default function ShortlistPanel({ shortlist, onClose, onRemove, onViewSchool }) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-semibold">Shortlist</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {shortlist.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Heart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No schools in your shortlist yet.</p>
            <p className="text-sm mt-1">Click the heart icon on schools to save them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shortlist.map((school) => (
              <div key={school.id} className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{school.name}</h3>
                  <button
                    onClick={() => onRemove(school.id)}
                    className="text-slate-400 hover:text-rose-500 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {school.city}, {school.region}
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Grades {school.lowestGrade}-{school.highestGrade} • {school.currency} {school.tuition?.toLocaleString()}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => onViewSchool(school.id)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Details
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
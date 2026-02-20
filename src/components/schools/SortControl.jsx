import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SortControl({ sortField, sortDirection, onSortFieldChange, onSortDirectionChange }) {
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'name', label: 'Name' },
    { value: 'distance', label: 'Distance' },
    { value: 'tuition', label: 'Tuition' }
  ];

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600 font-medium">Sort:</span>
      <select
        value={sortField}
        onChange={(e) => onSortFieldChange(e.target.value)}
        className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 text-sm hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button
        size="icon"
        variant="outline"
        onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
        className="h-8 w-8"
        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDirection === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
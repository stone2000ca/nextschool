'use client'

import { useState } from 'react'
import { X, Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFieldLabel } from '@/lib/functions/schoolAdminChat'

function formatValue(val) {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

export default function ReviewChangesDialog({
  changes,
  isApplying,
  onApply,
  onDiscard,
  onClose,
}) {
  const [selected, setSelected] = useState(
    () => new Set(changes.map((c) => c.field))
  )

  const toggleField = (field) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }

  const handleApply = () => {
    const toApply = changes.filter((c) => selected.has(c.field))
    onApply(toApply)
  }

  const selectedCount = selected.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Review Proposed Changes
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {changes.map((change) => {
            const isSelected = selected.has(change.field)
            return (
              <label
                key={change.field}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleField(change.field)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {getFieldLabel(change.field)}
                  </div>
                  <div className="mt-1.5 flex items-start gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-400 block mb-0.5">Before</span>
                      <span className="text-slate-600 bg-red-50 px-2 py-1 rounded block break-words">
                        {formatValue(change.oldValue)}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 mt-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-400 block mb-0.5">After</span>
                      <span className="text-slate-600 bg-green-50 px-2 py-1 rounded block break-words">
                        {formatValue(change.newValue)}
                      </span>
                    </div>
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <span className="text-xs text-slate-500">
            {selectedCount} of {changes.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDiscard}
              disabled={isApplying}
              className="text-xs"
            >
              Discard all
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isApplying || selectedCount === 0}
              className="text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-3 w-3" />
              {isApplying
                ? 'Applying...'
                : `Apply ${selectedCount} change${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

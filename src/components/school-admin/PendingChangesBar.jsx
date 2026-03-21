'use client'

import { AlertCircle, Check, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PendingChangesBar({
  count,
  isApplying,
  applyError,
  onReview,
  onApplyAll,
  onDiscard,
}) {
  if (count === 0) return null

  return (
    <div className="border-t border-border bg-amber-50 px-4 py-2.5 shrink-0">
      {applyError && (
        <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{applyError}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-amber-800">
          You have {count} profile change{count > 1 ? 's' : ''} ready to apply
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onReview}
            className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <Eye className="h-3 w-3" />
            Review changes
          </Button>
          <Button
            size="sm"
            onClick={onApplyAll}
            disabled={isApplying}
            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-3 w-3" />
            {isApplying ? 'Applying...' : 'Apply'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            disabled={isApplying}
            className="h-7 text-xs gap-1 text-slate-500 hover:text-red-600"
          >
            <X className="h-3 w-3" />
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { ClipboardCheck } from 'lucide-react'

const CARD_TITLES = [
  'Identity & Contact',
  'Branding & Media',
  'Type, Grades & Structure',
  'Tuition & Financial Aid',
  'Languages & Curriculum',
  'Programs & Learning Support',
  'Mission & Values',
  'Campus Life Snapshot',
  'Admissions Snapshot',
]

export default function KeyFactsList() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Key Fact Cards</h2>
      <ul className="space-y-2">
        {CARD_TITLES.map((title) => (
          <li
            key={title}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground"
          >
            <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            {title}
          </li>
        ))}
      </ul>
    </div>
  )
}

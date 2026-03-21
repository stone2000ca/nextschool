'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Pencil,
  SkipForward,
  X,
} from 'lucide-react'

// ─── Status chip logic ──────────────────────────────────────────────
function getCardStatus(fields, schoolData, aiEnrichedFields, verifiedFields) {
  const populatedFields = fields.filter(f => {
    const val = schoolData[f]
    if (val === null || val === undefined) return false
    if (Array.isArray(val)) return val.length > 0
    if (typeof val === 'string') return val.trim() !== ''
    return true
  })

  if (populatedFields.length === 0) return 'empty'

  const aiSet = new Set(aiEnrichedFields || [])
  const verifiedSet = typeof verifiedFields === 'object' && !Array.isArray(verifiedFields)
    ? new Set(Object.keys(verifiedFields).filter(k => verifiedFields[k]))
    : new Set(verifiedFields || [])

  const verifiedCount = populatedFields.filter(f => verifiedSet.has(f)).length

  if (verifiedCount === 0) {
    const anyAi = populatedFields.some(f => aiSet.has(f))
    return anyAi ? 'ai_draft' : 'empty'
  }
  if (verifiedCount >= populatedFields.length) return 'confirmed'
  return 'partially_confirmed'
}

const STATUS_CONFIG = {
  empty: { label: 'Not started', className: 'bg-slate-100 text-slate-500' },
  ai_draft: { label: 'AI draft', className: 'bg-blue-100 text-blue-700' },
  partially_confirmed: { label: 'Partially confirmed', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
}

// ─── Field summary ──────────────────────────────────────────────────
function getFieldSummary(fields, schoolData, fieldLabels) {
  const filled = fields.filter(f => {
    const v = schoolData[f]
    if (v === null || v === undefined) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'string') return v.trim() !== ''
    return true
  })
  return `${filled.length} of ${fields.length} fields filled`
}

// ─── Tag input (inline) ─────────────────────────────────────────────
function InlineTagInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const items = value || []

  const add = () => {
    if (!input.trim()) return
    onChange([...items, input.trim()])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md">
            {item}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:text-red-500">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  )
}

// ─── Field renderer ─────────────────────────────────────────────────
function FieldEditor({ field, label, type, options, value, onChange }) {
  switch (type) {
    case 'textarea':
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <Textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} className="text-sm" />
        </div>
      )
    case 'number':
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)} className="text-sm" />
        </div>
      )
    case 'boolean':
      return (
        <div className="flex items-center justify-between py-1">
          <Label className="text-sm">{label}</Label>
          <Switch checked={value || false} onCheckedChange={onChange} />
        </div>
      )
    case 'select':
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {(options || []).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case 'tags':
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <InlineTagInput value={value} onChange={onChange} placeholder={`Add ${label.toLowerCase()}`} />
        </div>
      )
    case 'image':
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="URL" className="text-sm" />
        </div>
      )
    default:
      return (
        <div>
          <Label className="text-sm">{label}</Label>
          <Input value={value || ''} onChange={e => onChange(e.target.value)} className="text-sm" />
        </div>
      )
  }
}

// ─── Main card component ────────────────────────────────────────────
export default function KeyFactCard({
  card,
  schoolData,
  aiEnrichedFields,
  verifiedFields,
  onConfirmAll,
  onSaveEdits,
  isConfirming,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({})

  const status = getCardStatus(card.fields.map(f => f.name), schoolData, aiEnrichedFields, verifiedFields)
  const statusCfg = STATUS_CONFIG[status]
  const summary = getFieldSummary(card.fields.map(f => f.name), schoolData, {})

  const handleEdit = () => {
    const initial = {}
    card.fields.forEach(f => {
      initial[f.name] = schoolData[f.name]
    })
    setEditValues(initial)
    setIsEditing(true)
    setIsExpanded(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditValues({})
  }

  const handleSaveEdit = () => {
    onSaveEdits(card.id, editValues)
    setIsEditing(false)
    setEditValues({})
  }

  const handleSkip = () => {
    setIsExpanded(false)
    setIsEditing(false)
  }

  const handleFieldChange = (fieldName, value) => {
    setEditValues(prev => ({ ...prev, [fieldName]: value }))
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
            {card.number}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{card.title}</span>
              {card.highImpact && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  High impact
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{summary}</span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          {status === 'confirmed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {card.fields.map(f => (
                  <div key={f.name} className={f.type === 'textarea' || f.type === 'tags' ? 'col-span-2' : ''}>
                    <FieldEditor
                      field={f.name}
                      label={f.label}
                      type={f.type}
                      options={f.options}
                      value={editValues[f.name]}
                      onChange={val => handleFieldChange(f.name, val)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button size="sm" onClick={handleSaveEdit} className="bg-teal-600 hover:bg-teal-700">
                  Save & Verify
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Field value display */}
              <div className="grid grid-cols-2 gap-3">
                {card.fields.map(f => {
                  const val = schoolData[f.name]
                  const display = Array.isArray(val) ? val.join(', ') : (val != null ? String(val) : '—')
                  const isAi = (aiEnrichedFields || []).includes(f.name)
                  const isVerified = typeof verifiedFields === 'object' && !Array.isArray(verifiedFields)
                    ? verifiedFields[f.name]
                    : (verifiedFields || []).includes(f.name)

                  return (
                    <div key={f.name} className="text-sm">
                      <span className="text-slate-500">{f.label}: </span>
                      <span className={`font-medium ${isAi && !isVerified ? 'text-blue-700' : 'text-slate-800'}`}>
                        {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : display}
                      </span>
                      {isAi && !isVerified && (
                        <span className="ml-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">AI</span>
                      )}
                      {isVerified && (
                        <CheckCircle2 className="inline ml-1 h-3 w-3 text-green-500" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button
                  size="sm"
                  onClick={() => onConfirmAll(card.id, card.fields.map(f => f.name))}
                  disabled={status === 'confirmed' || isConfirming}
                  className="bg-green-600 hover:bg-green-700 gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isConfirming ? 'Confirming...' : 'Confirm all'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleEdit} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSkip} className="gap-1 text-slate-500">
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export { getCardStatus }

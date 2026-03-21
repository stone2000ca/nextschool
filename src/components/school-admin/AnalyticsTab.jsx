'use client'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Heart, Users, Star, MapPin } from 'lucide-react'

const IMPRESSION_LABELS = {
  loved_it: 'Loved it',
  mixed: 'Mixed',
  not_for_us: 'Not for us',
  unknown: 'Unknown',
}

const STATUS_LABELS = {
  shortlisted: 'Shortlisted',
  removed: 'Removed',
  touring: 'Touring',
  visited: 'Visited',
  unknown: 'Unknown',
}

function Skeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="h-3 w-20 bg-muted rounded animate-pulse mb-3" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-64 text-center">
      <Users className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground mb-1">No analytics data yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Analytics will appear here as families discover and interact with your school profile.
      </p>
    </div>
  )
}

function Sparkline({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.count), 1)
  const barCount = data.length

  return (
    <div className="flex items-end gap-0.5 h-8 mt-2">
      {data.map((point, i) => (
        <div
          key={i}
          className="flex-1 bg-teal-500 rounded-t-sm opacity-70 hover:opacity-100 transition-opacity"
          style={{ height: `${(point.count / max) * 100}%`, minHeight: barCount > 0 ? '2px' : 0 }}
          title={`${point.month}: ${point.count}`}
        />
      ))}
    </div>
  )
}

function StatusBar({ items, labels }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return <p className="text-xs text-muted-foreground mt-2">No journey data</p>

  return (
    <div className="space-y-1.5 mt-2">
      {items.map((item) => {
        const pct = Math.round((item.count / total) * 100)
        return (
          <div key={item.status || item.impression} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-muted-foreground truncate">
              {labels[item.status || item.impression] || item.status || item.impression}
            </span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-muted-foreground">{item.count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsTab({ schoolId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!schoolId) return
    setLoading(true)
    setError(null)

    fetch(`/api/school-analytics?school_id=${encodeURIComponent(schoolId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analytics')
        return res.json()
      })
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  if (loading) return <Skeleton />
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  const isEmpty =
    data.shortlistCount === 0 &&
    data.journeyStatusBreakdown.length === 0 &&
    data.visitCount === 0

  if (isEmpty) return <EmptyState />

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Analytics</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Shortlist Saves */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Shortlist Saves</span>
            <Heart className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{data.shortlistCount}</div>
          <Sparkline data={data.shortlistTimeSeries} />
        </Card>

        {/* Match Score */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Avg Match Score</span>
            <Star className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data.avgMatchScore != null ? `${data.avgMatchScore}%` : '—'}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {data.avgMatchScore != null
              ? 'Average across all matched families'
              : 'No match data yet'}
          </p>
        </Card>

        {/* Journey Funnel */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Journey Funnel</span>
            <Users className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data.journeyStatusBreakdown.reduce((s, i) => s + i.count, 0)}
          </div>
          <StatusBar items={data.journeyStatusBreakdown} labels={STATUS_LABELS} />
        </Card>

        {/* Visit Sentiment */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Visit Sentiment</span>
            <MapPin className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{data.visitCount}</div>
          <StatusBar items={data.visitSentiment} labels={IMPRESSION_LABELS} />
        </Card>
      </div>
    </div>
  )
}

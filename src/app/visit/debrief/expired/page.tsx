'use client'

import { LOGO_BLACK_TEXT } from '@/lib/brand-assets'

/**
 * /visit/debrief/expired — E51-S1A
 *
 * Friendly fallback page shown when a debrief email link token
 * has expired or has already been used.
 *
 * Design: centered card, teal accent, NextSchool logo, CTA back to app.
 */
export default function DebriefExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        {/* Logo */}
        <div className="mb-6">
          <img
            src={LOGO_BLACK_TEXT}
            alt="NextSchool"
            className="h-8 mx-auto"
          />
        </div>

        {/* Teal accent bar */}
        <div className="w-12 h-1 bg-teal-500 rounded-full mx-auto mb-6" />

        {/* Copy */}
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          This link has expired
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Open the app to add your notes.
        </p>

        {/* CTA */}
        <a
          href="/consultant"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Open NextSchool
        </a>
      </div>
    </div>
  )
}

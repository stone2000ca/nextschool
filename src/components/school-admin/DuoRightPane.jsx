'use client'
import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SAMPLE_MESSAGES = [
  { role: 'assistant', text: "Hi! I'm your NextSchool account manager. I can help you update your school profile, review analytics, and more. What would you like to work on today?" },
  { role: 'user', text: 'How do I update my tuition information?' },
  { role: 'assistant', text: "Great question! You can update tuition details in the Key Facts tab on the left — look for the \"Tuition & Financial Aid\" card. I'll be able to help you edit it directly soon!" },
]

export default function DuoRightPane({ schoolName }) {
  const [inputValue, setInputValue] = useState('')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{schoolName || 'School'}</h2>
            <p className="text-xs text-muted-foreground">Your NextSchool account manager</p>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {SAMPLE_MESSAGES.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask your account manager..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1"
          />
          <Button size="icon" variant="default" className="bg-teal-600 hover:bg-teal-700 shrink-0" disabled>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Bot, User } from 'lucide-react'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-slate-200' : 'bg-teal-600'
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-slate-600" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-teal-600 text-white'
            : 'bg-muted text-foreground'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

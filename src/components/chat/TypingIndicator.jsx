export default function TypingIndicator({ message = "Thinking...", consultantName = "Liam" }) {
  const accentColor = consultantName === 'Jackie' ? '#C27B8A' : '#6B9DAD';
  
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: accentColor }} aria-hidden="true">
        {consultantName === 'Jackie' ? 'J' : 'L'}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-slate-600 animate-pulse">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}
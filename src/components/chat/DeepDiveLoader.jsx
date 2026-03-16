import { useState, useEffect } from 'react';

const STATUS_MESSAGES = [
  'Analyzing school profile',
  'Evaluating fit with your priorities',
  'Preparing personalized insights',
];

export default function DeepDiveLoader({ schoolName, consultantName = 'Liam' }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const accentColor = consultantName === 'Jackie' ? '#C27B8A' : '#6B9DAD';

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % STATUS_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 animate-fadeIn">
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      >
        {consultantName === 'Jackie' ? 'J' : 'L'}
      </div>
      <div className="bg-[#334155] rounded-2xl px-4 py-3 max-w-[85%]">
        <div className="flex flex-col gap-2.5">
          {/* Orbit Scan animation */}
          <div className="ns-orbit-track">
            <div className="ns-orbit-arc ns-orbit-arc-1" style={{ borderTopColor: accentColor, borderRightColor: accentColor }} />
            <div className="ns-orbit-arc ns-orbit-arc-2" style={{ borderBottomColor: accentColor, borderLeftColor: accentColor }} />
            <svg className="ns-orbit-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.54 38.56">
              <polygon fill="#ffffff" points="15.48 8.77 21.54 18.11 22.29 19.26 21.54 20.42 15.48 29.76 21.18 35.46 21.28 35.56 37.53 19.27 21.85 3.59 21.27 3.01 15.48 8.77"/>
              <path fill={accentColor} d="M20.21,0h-11.7L0,8.48l7,10.78L0,30.05l8.52,8.52h12.76l19.26-19.3L21.28,0h-1.06ZM37.53,19.27l-16.26,16.29-.09-.09-5.7-5.7,6.06-9.34.75-1.16-.75-1.16-6.06-9.34,5.79-5.76.58.58,15.68,15.68Z"/>
            </svg>
          </div>

          {/* Status text */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 ns-status-fade" key={statusIndex}>
              {STATUS_MESSAGES[statusIndex]}
              {schoolName ? ` for ${schoolName}` : ''}…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

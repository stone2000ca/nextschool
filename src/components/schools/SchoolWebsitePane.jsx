import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Globe2, AlertTriangle, Loader2, Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HELPER_PROMPTS = [
  'Find tuition info on their site, then ask me to compare it to your budget',
  'Browse their programs & clubs, then note favorites in My Notes',
  'Check admission deadlines, then ask me what steps to take next',
];

const LOAD_TIMEOUT_MS = 8000;

export default function SchoolWebsitePane({ school }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'blocked'
  const [helperDismissed, setHelperDismissed] = useState(false);
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);

  const websiteUrl = school?.website
    ? (school.website.startsWith('http') ? school.website : `https://${school.website}`)
    : null;

  const handleLoad = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setStatus('loaded');
  }, []);

  const handleError = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setStatus('blocked');
  }, []);

  useEffect(() => {
    if (!websiteUrl) return;
    setStatus('loading');
    setHelperDismissed(false);
    timeoutRef.current = setTimeout(() => {
      setStatus((prev) => (prev === 'loading' ? 'blocked' : prev));
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [websiteUrl]);

  if (!websiteUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#9a9590] p-8">
        <Globe2 className="h-10 w-10 mb-3 text-[#6b6560]" />
        <p className="text-sm font-medium">No website available for this school.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#141a1f' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-teal-600 bg-teal-600/10 shrink-0">
        <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold">
          <Globe2 className="h-4 w-4" />
          School Website
        </div>
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
        >
          Open in new tab
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Helper prompts */}
      {!helperDismissed && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 bg-teal-950/20 border-b border-white/[0.06] shrink-0">
          <Lightbulb className="h-3.5 w-3.5 text-teal-400/70 mt-0.5 shrink-0" />
          <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1">
            {HELPER_PROMPTS.map((prompt, i) => (
              <span key={i} className="text-[11px] text-teal-400/60 leading-snug">
                {i > 0 && <span className="mr-3 text-white/10">·</span>}
                {prompt}
              </span>
            ))}
          </div>
          <button
            onClick={() => setHelperDismissed(true)}
            className="text-teal-400/40 hover:text-teal-400/70 transition-colors shrink-0"
            aria-label="Dismiss tips"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#141a1f]">
            <Loader2 className="h-8 w-8 text-teal-500 animate-spin mb-3" />
            <p className="text-sm text-[#9a9590]">Loading school website...</p>
          </div>
        )}

        {status === 'blocked' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#141a1f] p-8">
            <AlertTriangle className="h-10 w-10 text-amber-400 mb-4" />
            <p className="text-[15px] font-semibold text-[#e8e6e1] mb-2 text-center">
              This school&apos;s website can&apos;t be embedded for security reasons.
            </p>
            <p className="text-sm text-[#9a9590] mb-5 text-center max-w-sm">
              Many websites block embedding to protect their visitors. You can still view it directly.
            </p>
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </Button>
            </a>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={websiteUrl}
          title={`${school.name} website`}
          className={`w-full h-full border-0 ${status === 'blocked' ? 'hidden' : ''}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}

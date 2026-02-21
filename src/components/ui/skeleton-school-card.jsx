import { Card } from "@/components/ui/card";

export default function SkeletonSchoolCard() {
  return (
    <Card className="overflow-hidden h-full flex flex-col animate-pulse">
      {/* Image skeleton */}
      <div className="h-48 bg-slate-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 animate-shimmer" />
      </div>

      {/* Content skeleton */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
        
        <div className="flex gap-2 mb-3">
          <div className="h-6 bg-slate-200 rounded w-16" />
          <div className="h-6 bg-slate-200 rounded w-20" />
        </div>
        
        <div className="h-5 bg-slate-200 rounded w-32 mb-4" />
        
        <div className="flex-1" />
        
        <div className="h-10 bg-slate-200 rounded w-full" />
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </Card>
  );
}
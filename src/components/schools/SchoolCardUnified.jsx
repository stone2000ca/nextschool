import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Heart, DollarSign, Users, Navigation, Check, AlertTriangle, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HeaderPhotoDisplay, LogoDisplay } from '@/components/schools/HeaderPhotoHelper';

export default function SchoolCardUnified({ 
  school, 
  onViewDetails, 
  onToggleShortlist, 
  isShortlisted, 
  index = 0, 
  variant = "full",
  accentColor = "#0D9488"
}) {
  const getCurrencySymbol = (currency) => {
    const symbols = { CAD: 'CA$', USD: '$', EUR: '€', GBP: '£' };
    return symbols[currency] || '$';
  };

  const formatGrade = (grade) => {
    if (grade === null || grade === undefined) return '';
    const num = Number(grade);
    if (num <= -2) return 'PK';
    if (num === -1) return 'JK';
    if (num === 0) return 'K';
    return String(num);
  };

  const formatGradeRange = (gradeFrom, gradeTo) => {
    const from = formatGrade(gradeFrom);
    const to = formatGrade(gradeTo);
    if (!from && !to) return '';
    if (!from) return to;
    if (!to) return from;
    return `${from}-${to}`;
  };

  // Tuition display logic
  const renderTuition = () => {
    if (school.dayTuition && school.boardingTuition) {
      return (
        <span className="text-xs sm:text-sm">
          {getCurrencySymbol(school.currency)}{school.dayTuition.toLocaleString()} (day) / {getCurrencySymbol(school.currency)}{school.boardingTuition.toLocaleString()} (boarding)
        </span>
      );
    } else if (school.dayTuition) {
      return (
        <>
          {getCurrencySymbol(school.currency)}{school.dayTuition.toLocaleString()}
          <span className="text-xs text-slate-500 font-normal ml-1">(day)</span>
        </>
      );
    } else if (school.boardingTuition) {
      return (
        <>
          {getCurrencySymbol(school.currency)}{school.boardingTuition.toLocaleString()}
          <span className="text-xs text-slate-500 font-normal ml-1">(boarding)</span>
        </>
      );
    } else if (school.tuition) {
      return (
        <>
          {getCurrencySymbol(school.currency)}{school.tuition.toLocaleString()}
          <span className="text-xs text-slate-500 font-normal ml-1">/year</span>
        </>
      );
    }
    return 'Contact school';
  };

  // Variant-specific classes
  const isCompact = variant === "compact";
  const isFeatured = variant === "featured";

  return (
    <Card 
      className={`ns-card-interactive transition-all duration-300 cursor-pointer group h-full flex flex-col focus-within:ring-2 focus-within:ring-offset-2`}
      style={{
        animation: 'fadeSlideUp 0.4s ease-out',
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'backwards',
        '--accent-color': accentColor
      }}
      onClick={onViewDetails}
      role="button"
      tabIndex={0}
      aria-label={`View ${school.name} school profile`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails();
        }
      }}
    >
      <style jsx>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .group:hover {
          border-color: var(--accent-color);
        }
      `}</style>

      {/* Image - 16:9 aspect ratio */}
      <div className={`relative bg-slate-200 overflow-hidden ${isCompact ? 'h-32' : isFeatured ? 'h-56' : 'h-48'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400" />
        <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-300">
          <HeaderPhotoDisplay 
            headerPhotoUrl={school.headerPhotoUrl}
            heroImage={school.heroImage}
            schoolName={school.name}
            height={isCompact ? "h-32" : isFeatured ? "h-56" : "h-48"}
          />
        </div>
        
        {/* Managed badge */}
        {school.claimStatus === 'claimed' && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-teal-600 text-white flex items-center gap-1">
            <Award className="h-3 w-3" />
            Managed by school
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2 mb-2">
          <LogoDisplay logoUrl={school.logoUrl} schoolName={school.name} schoolWebsite={school.website} size="h-5 w-5" />
          <h3 className={`font-bold ${isCompact ? 'text-base' : 'text-lg'} line-clamp-2 flex-1`}>
            {school.name}
          </h3>
        </div>
        
        <div className="flex items-center gap-1 text-sm text-slate-600 mb-3">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="line-clamp-1">{school.city}, {school.provinceState}</span>
        </div>
        
        {/* Distance badge */}
        {school.distanceKm && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-xs font-medium">
              <Navigation className="h-3 w-3" />
              {school.distanceKm.toFixed(1)} km away
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          {formatGradeRange(school.lowestGrade, school.highestGrade) && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              Gr {formatGradeRange(school.lowestGrade, school.highestGrade)}
            </Badge>
          )}
          {school.genderPolicy && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {school.genderPolicy}
            </Badge>
          )}
          {school.curriculumType && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {school.curriculumType}
            </Badge>
          )}
        </div>

        {/* Tuition */}
        <div className="flex items-center gap-1 text-slate-900 font-semibold text-sm mb-3">
          <DollarSign className="h-4 w-4 flex-shrink-0" />
          <span className="line-clamp-1">{renderTuition()}</span>
        </div>

        {/* Match Explanations */}
        {!isCompact && school.matchExplanations && school.matchExplanations.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-200" />
            <div className="space-y-2 text-xs flex-1">
              {school.matchExplanations.map((match, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {match.type === 'positive' ? (
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={match.type === 'positive' ? 'text-slate-700' : 'text-slate-600'}>
                    {match.text}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {!isCompact && (
        <div className="px-4 pb-4">
          <Button
            variant={isShortlisted ? "default" : "outline"}
            size="sm"
            className={`w-full ${isShortlisted ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleShortlist(school.id);
            }}
            aria-label={isShortlisted ? `Remove ${school.name} from shortlist` : `Add ${school.name} to shortlist`}
          >
            <Heart className={`h-4 w-4 mr-2 ${isShortlisted ? 'fill-current' : ''}`} />
            {isShortlisted ? 'Shortlisted' : 'Add to Shortlist'}
          </Button>
        </div>
      )}
    </Card>
  );
}
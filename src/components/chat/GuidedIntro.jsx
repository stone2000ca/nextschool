'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CONSULTANT_AVATARS } from '@/lib/brand-assets';
import { ArrowRight, Pencil } from 'lucide-react';

// ─── Persona copy variants ───────────────────────────────────────────
const COPY = {
  Jackie: {
    1: "Hi, I'm Jackie!",
    2: (name) => `Nice to meet you, ${name}!`,
    2.5: (name, childName) => `Great — thanks!`,
    3: (name) => `Got it, ${name}.`,
    4: "Perfect.",
    5: "Almost there.",
    5.5: "Good to know.",
    6: (name) => `We're all set, ${name}.`,
  },
  Liam: {
    1: "Hey — I'm Liam.",
    2: () => "Good. And your child?",
    2.5: () => "Got it.",
    3: () => "Got it.",
    4: "Perfect.",
    5: "One more.",
    5.5: "Good to know.",
    6: (name) => `Alright, ${name}. Let's go.`,
  },
};

const SUBTITLES = {
  1: "What's your first name?",
  2: "What's your child's first name?",
  2.5: null, // dynamic — set in getSubtitle()
  3: "What grade are they entering?",
  4: "Where are you located?",
  5: "What's your tuition budget?",
  5.5: "Any school type preferences?",
  6: "Here's what I've got.",
};

const GRADES = ['JK', 'SK', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const BUDGET_OPTIONS = [
  'Under $15K',
  '$15K–$25K',
  '$25K–$40K',
  '$40K+',
  'Not sure yet',
];

const PRONOUN_OPTIONS = ['He/him', 'She/her', 'They/them', 'Prefer not to say'];

const SCHOOL_TYPE_GROUPS = [
  {
    label: 'Curriculum & Pedagogy',
    options: ['IB Programme', 'Montessori', 'STEM/STEAM Focus', 'Arts Focus', 'French Immersion'],
    expandedOptions: ['Waldorf', 'AP (Advanced Placement)', 'Reggio Emilia'],
  },
  {
    label: 'School Structure',
    options: ['Faith-based', 'Girls-only', 'Boys-only', 'Boarding/Residential', 'Small class sizes'],
    expandedOptions: [],
  },
];

// Steps indexed 0-7 mapping to display steps 1,2,2.5,3,4,5,5.5,6
const STEP_KEYS = [1, 2, 2.5, 3, 4, 5, 5.5, 6];
const TOTAL_STEPS = STEP_KEYS.length;

export default function GuidedIntro({ consultantName, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState('forward'); // 'forward' | 'back'

  // Collected data
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [grade, setGrade] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [pronoun, setPronoun] = useState('');
  const [schoolTypes, setSchoolTypes] = useState([]);
  const [showMoreSchoolTypes, setShowMoreSchoolTypes] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  const stepKey = STEP_KEYS[stepIndex];

  // Focus text inputs when step changes
  useEffect(() => {
    if ([1, 2, 4].includes(stepKey)) {
      // Small delay so the DOM has rendered
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [stepKey]);

  // ─── Answer summary for overlay ─────────────────────────────────
  const collectedAnswers = [
    { stepIndex: 0, label: 'Your name', value: parentName },
    { stepIndex: 1, label: "Child's name", value: childName },
    { stepIndex: 2, label: 'Pronouns', value: pronoun },
    { stepIndex: 3, label: 'Grade', value: grade },
    { stepIndex: 4, label: 'Location', value: location },
    { stepIndex: 5, label: 'Budget', value: budget },
    { stepIndex: 6, label: 'School type', value: schoolTypes.length > 0 ? schoolTypes.join(', ') : '' },
  ].filter((a) => a.value && a.stepIndex < stepIndex);

  const jumpToStep = useCallback((targetIndex) => {
    if (animating) return;
    setShowSummary(false);
    if (targetIndex === stepIndex) return;
    setDirection(targetIndex < stepIndex ? 'back' : 'forward');
    setAnimating(true);
    setTimeout(() => {
      setStepIndex(targetIndex);
      setAnimating(false);
    }, 300);
  }, [animating, stepIndex]);

  // Dismiss overlay on Escape or click outside
  useEffect(() => {
    if (!showSummary) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowSummary(false);
    };
    const handleClick = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        setShowSummary(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    // Delay click listener to avoid catching the opening click
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
      clearTimeout(t);
    };
  }, [showSummary]);

  // ─── Navigation ──────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (animating) return;
    if (stepIndex >= TOTAL_STEPS - 1) return;
    setDirection('forward');
    setAnimating(true);
    setTimeout(() => {
      setStepIndex((i) => i + 1);
      setAnimating(false);
    }, 300);
  }, [animating, stepIndex]);

  const goBack = useCallback(() => {
    if (animating) return;
    if (stepIndex <= 0) return;
    setDirection('back');
    setAnimating(true);
    setTimeout(() => {
      setStepIndex((i) => i - 1);
      setAnimating(false);
    }, 300);
  }, [animating, stepIndex]);

  // ─── Heading copy ────────────────────────────────────────────────
  const getHeading = () => {
    const copySet = COPY[consultantName] || COPY.Jackie;
    const val = copySet[stepKey];
    if (typeof val === 'function') return val(parentName || 'there', childName || 'your child');
    return val;
  };

  // ─── Resolve subject pronoun from selection ────────────────────
  const subjectPronoun = (() => {
    switch (pronoun) {
      case 'He/him': return 'he';
      case 'She/her': return 'she';
      default: return 'they';
    }
  })();

  // ─── Dynamic subtitle ──────────────────────────────────────────
  const getSubtitle = () => {
    if (stepKey === 2.5) {
      return `What pronouns should we use for ${childName || 'your child'}?`;
    }
    if (stepKey === 3) {
      return `What grade ${subjectPronoun === 'they' ? 'are' : 'is'} ${subjectPronoun} entering?`;
    }
    return SUBTITLES[stepKey];
  };

  // ─── Enter-to-advance for text fields ────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Validate non-empty
      if (stepKey === 1 && parentName.trim()) goNext();
      if (stepKey === 2 && childName.trim()) goNext();
      if (stepKey === 4 && location.trim()) goNext();
    }
  };

  // ─── Auto-advance helpers ────────────────────────────────────────
  const selectGrade = (g) => {
    setGrade(g);
    // auto-advance after brief highlight
    setTimeout(goNext, 350);
  };

  const selectBudget = (b) => {
    setBudget(b);
    setTimeout(goNext, 350);
  };

  const selectPronoun = (p) => {
    setPronoun(p);
    setTimeout(goNext, 350);
  };

  const toggleSchoolType = (type) => {
    setSchoolTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      return [...prev, type];
    });
  };

  // ─── Completion ──────────────────────────────────────────────────
  const handleComplete = () => {
    const familyBrief = {
      parentName: parentName.trim(),
      childName: childName.trim(),
      pronoun,
      grade,
      location: location.trim(),
      budget,
      schoolTypePreferences: schoolTypes.length > 0 ? [...schoolTypes] : [],
    };
    onComplete(familyBrief);
  };

  // ─── Progress bar width ──────────────────────────────────────────
  const progressPct = ((stepIndex + 1) / TOTAL_STEPS) * 100;

  // ─── Accent color per consultant ─────────────────────────────────
  const accent = consultantName === 'Jackie' ? '#C27B8A' : '#6B9DAD';

  // ─── Render helpers ──────────────────────────────────────────────
  const renderTextInput = (value, setValue, placeholder) => (
    <div className="w-full max-w-md mx-auto">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="guided-intro-input w-full bg-transparent text-center text-white text-2xl py-3 px-1 placeholder:text-white/30 transition-colors"
        style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
        autoComplete="off"
      />
      <p className="text-white/40 text-sm mt-3">Press Enter to continue</p>
    </div>
  );

  const renderChipGrid = (options, selected, onSelect, multi = false) => (
    <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
      {options.map((opt) => {
        const isSelected = multi ? selected.includes(opt) : selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-5 py-3 rounded-full text-base font-medium transition-all duration-200 border
              ${isSelected
                ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  const renderBudgetCards = () => (
    <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
      {BUDGET_OPTIONS.map((opt) => {
        const isSelected = budget === opt;
        return (
          <button
            key={opt}
            onClick={() => selectBudget(opt)}
            className={`px-6 py-4 rounded-xl text-base font-medium transition-all duration-200 border
              ${isSelected
                ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  const renderSummary = () => (
    <div className="w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      {[
        ['Parent', parentName],
        ['Child', childName],
        ['Pronouns', pronoun || '—'],
        ['Grade', grade],
        ['Location', location],
        ['Budget', budget],
        ['School type', schoolTypes.length > 0 ? schoolTypes.join(', ') : 'No preference'],
      ].map(([label, val]) => (
        <div key={label} className="flex justify-between items-center">
          <span className="text-white/50 text-sm">{label}</span>
          <span className="text-white font-medium">{val}</span>
        </div>
      ))}
    </div>
  );

  // ─── Step content ────────────────────────────────────────────────
  const renderStepContent = () => {
    switch (stepKey) {
      case 1:
        return renderTextInput(parentName, setParentName, 'Your first name');
      case 2:
        return renderTextInput(childName, setChildName, "Your child's first name");
      case 2.5:
        return renderChipGrid(PRONOUN_OPTIONS, pronoun, selectPronoun);
      case 3:
        return renderChipGrid(GRADES, grade, selectGrade);
      case 4:
        return renderTextInput(location, setLocation, 'City or postal code');
      case 5:
        return renderBudgetCards();
      case 5.5:
        return (
          <div className="space-y-6">
            {SCHOOL_TYPE_GROUPS.map((group) => {
              const visibleOptions = group.options;
              const hiddenOptions = group.expandedOptions;
              return (
                <div key={group.label} className="space-y-3">
                  <p className="text-white/30 text-xs font-medium uppercase tracking-widest">{group.label}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {visibleOptions.map((opt) => {
                      const isSelected = schoolTypes.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleSchoolType(opt)}
                          className={`px-5 py-3 rounded-full text-base font-medium transition-all duration-200 border
                            ${isSelected
                              ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                    {showMoreSchoolTypes && hiddenOptions.map((opt) => {
                      const isSelected = schoolTypes.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleSchoolType(opt)}
                          className={`px-5 py-3 rounded-full text-base font-medium transition-all duration-200 border
                            ${isSelected
                              ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-lg shadow-teal-500/10'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!showMoreSchoolTypes && (
              <button
                onClick={() => setShowMoreSchoolTypes(true)}
                className="text-white/40 hover:text-white/60 text-sm transition-colors underline underline-offset-2"
              >
                More options
              </button>
            )}
            <div className="flex justify-center mt-2">
              <button
                onClick={goNext}
                className="px-8 py-3 rounded-full bg-teal-500/20 border border-teal-400 text-teal-300 font-medium hover:bg-teal-500/30 transition-all"
              >
                {schoolTypes.length > 0 ? 'Continue' : 'Skip — no preference'}
              </button>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            {renderSummary()}
            <div className="flex justify-center">
              <button
                onClick={handleComplete}
                className="group flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                style={{ background: `linear-gradient(135deg, ${accent}, #2dd4bf)` }}
              >
                Let&apos;s find schools
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // ─── Animation class ─────────────────────────────────────────────
  const contentClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-y-4'
      : 'opacity-0 -translate-y-4'
    : 'opacity-100 translate-y-0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-slowFloat" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-slowFloatReverse" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 w-full h-1 bg-white/5">
        <div
          className="h-full bg-teal-400 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Consultant avatar badge */}
      <div className="relative z-20 p-6">
        <button
          type="button"
          onClick={() => { if (collectedAnswers.length > 0) setShowSummary((s) => !s); }}
          className={`flex items-center gap-3 group ${collectedAnswers.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label="Review your answers"
          aria-expanded={showSummary}
        >
          <div className="relative">
            <div
              className="w-12 h-12 rounded-full overflow-hidden border-2 shadow-lg transition-shadow duration-200 group-hover:shadow-xl"
              style={{ borderColor: accent, boxShadow: showSummary ? `0 0 16px ${accent}60` : undefined }}
            >
              <img
                src={CONSULTANT_AVATARS[consultantName]}
                alt={consultantName}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Pulse ring */}
            {!showSummary && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ borderWidth: 2, borderStyle: 'solid', borderColor: accent }}
              />
            )}
            {/* Edit hint badge — shows once there are answers to review */}
            {collectedAnswers.length > 0 && !showSummary && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-slate-700 border border-white/20 flex items-center justify-center">
                <Pencil className="w-2.5 h-2.5 text-white/70" />
              </div>
            )}
          </div>
          <span className="text-white/60 text-sm font-medium">{consultantName}</span>
        </button>

        {/* Answer summary overlay */}
        {showSummary && collectedAnswers.length > 0 && (
          <div
            ref={overlayRef}
            className="absolute top-full left-6 mt-1 w-72 bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Your answers so far"
          >
            <div className="px-4 pt-4 pb-2">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wide">
                Want to change anything?
              </p>
            </div>
            <div className="px-2 pb-2">
              {collectedAnswers.map((a) => (
                <button
                  key={a.stepIndex}
                  type="button"
                  onClick={() => jumpToStep(a.stepIndex)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group/item text-left"
                >
                  <div className="min-w-0">
                    <span className="text-white/40 text-xs block">{a.label}</span>
                    <span className="text-white text-sm font-medium truncate block">{a.value}</span>
                  </div>
                  <Pencil className="w-3.5 h-3.5 text-white/20 group-hover/item:text-white/50 flex-shrink-0 ml-2 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-12">
        <div className={`transition-all duration-300 ease-out w-full max-w-2xl text-center ${contentClass}`}>
          {/* Heading */}
          <h1
            className="text-4xl md:text-5xl text-white mb-3"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500 }}
          >
            {getHeading()}
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-white/50 mb-10">{getSubtitle()}</p>

          {/* Step content */}
          {renderStepContent()}
        </div>
      </div>

      {/* Back button (visible after step 1) */}
      {stepIndex > 0 && (
        <div className="relative z-10 p-6">
          <button
            onClick={goBack}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            &larr; Back
          </button>
        </div>
      )}
    </div>
  );
}

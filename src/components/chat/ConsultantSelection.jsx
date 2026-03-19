'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CONSULTANT_AVATARS } from '@/lib/brand-assets';

const TRANSITION_DURATION = 0.6; // seconds
const EASE_CURVE = [0.4, 0, 0.2, 1]; // material decelerate

const consultants = [
  {
    name: 'Jackie',
    title: 'The Warm & Supportive Consultant',
    tagline: 'Empathetic, encouraging, and emotionally attuned',
    description: 'Jackie excels at understanding family dynamics and emotional needs. She validates concerns, celebrates strengths, and makes families feel truly heard throughout the school search journey.',
    color: 'from-rose-500 to-pink-500',
    avatar: CONSULTANT_AVATARS.Jackie,
    isImage: true,
    traits: [
      { label: 'Style', value: 'Warm & Encouraging' },
      { label: 'Strength', value: 'Emotional Intelligence' },
      { label: 'Pace', value: 'Thoughtful & Thorough' },
      { label: 'Best For', value: 'Families in Transition' },
    ],
  },
  {
    name: 'Liam',
    title: 'The Direct & Strategic Consultant',
    tagline: 'Data-driven, efficient, and results-oriented',
    description: 'Liam cuts through the noise with clear analysis and strategic recommendations. He focuses on matching your priorities with school data and gets you to the best fit quickly.',
    color: 'from-blue-500 to-cyan-500',
    avatar: CONSULTANT_AVATARS.Liam,
    isImage: true,
    traits: [
      { label: 'Style', value: 'Direct & Clear' },
      { label: 'Strength', value: 'Strategic Analysis' },
      { label: 'Pace', value: 'Efficient & Focused' },
      { label: 'Best For', value: 'Goal-Driven Families' },
    ],
  },
];

export default function ConsultantSelection({ onSelectConsultant }) {
  const [selected, setSelected] = useState(null);      // name of chosen consultant
  const [transitioning, setTransitioning] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSelect = useCallback((name) => {
    if (transitioning) return;

    // prefers-reduced-motion: skip animation entirely
    if (shouldReduceMotion) {
      onSelectConsultant(name);
      return;
    }

    setSelected(name);
    setTransitioning(true);

    // Fire parent callback after animation completes
    setTimeout(() => {
      onSelectConsultant(name);
    }, TRANSITION_DURATION * 1000);
  }, [transitioning, shouldReduceMotion, onSelectConsultant]);

  const chosenConsultant = consultants.find(c => c.name === selected);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-slowFloat" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-slowFloatReverse" />
      </div>

      {/* Dark navy overlay that fades in during transition */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            className="absolute inset-0 z-30"
            style={{ background: 'radial-gradient(ellipse at center, #0B1A2B 0%, #0a0f1a 100%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: TRANSITION_DURATION * 0.7, delay: TRANSITION_DURATION * 0.3, ease: EASE_CURVE }}
          />
        )}
      </AnimatePresence>

      {/* Avatar that morphs to badge position during transition */}
      <AnimatePresence>
        {transitioning && chosenConsultant && (
          <motion.div
            layoutId="consultant-avatar"
            className="fixed z-50"
            initial={false}
            animate={{
              top: 16,
              left: 16,
              width: 40,
              height: 40,
            }}
            transition={{ duration: TRANSITION_DURATION * 0.8, delay: TRANSITION_DURATION * 0.2, ease: EASE_CURVE }}
          >
            <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg">
              <img
                src={chosenConsultant.avatar}
                alt={chosenConsultant.name}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl w-full relative z-10">
        {/* Header */}
        <AnimatePresence>
          {!transitioning && (
            <motion.div
              className="text-center mb-16"
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: EASE_CURVE }}
            >
              <h1 className="text-5xl font-bold text-white mb-4">
                Meet Your Consultant
              </h1>
              <p className="text-xl text-slate-300">
                Choose the consultant style that works best for your family
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Consultant Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {consultants.map((consultant) => {
            const isChosen = selected === consultant.name;
            const isOther = selected && !isChosen;

            return (
              <AnimatePresence key={consultant.name}>
                {/* Hide non-chosen card after fade-out; keep chosen card for expand */}
                {!(isOther && transitioning) && (
                  <motion.div
                    className="group relative"
                    layout={isChosen}
                    // Non-chosen card fades out
                    {...(isOther && transitioning ? {
                      exit: { opacity: 0, scale: 0.95 },
                    } : {})}
                    // Chosen card expands to fullscreen
                    animate={
                      isChosen && transitioning
                        ? {
                            scale: 1.05,
                            opacity: 0,
                            zIndex: 40,
                          }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={
                      isChosen && transitioning
                        ? { duration: TRANSITION_DURATION, ease: EASE_CURVE }
                        : isOther
                          ? { duration: 0.25, ease: 'easeOut' }
                          : { duration: 0.3 }
                    }
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-600 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />

                    <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-8 hover:border-slate-500 transition-all h-full flex flex-col">
                      {/* Consultant Avatar & Name */}
                      <div className="mb-8">
                        {/* Avatar — uses layoutId for morph when NOT yet transitioning the fixed one */}
                        <div className={`w-40 h-40 rounded-2xl bg-gradient-to-br ${consultant.color} flex items-center justify-center text-4xl mb-6 shadow-2xl overflow-hidden mx-auto`}>
                          {!isChosen || !transitioning ? (
                            <motion.div
                              layoutId={isChosen ? "consultant-avatar" : undefined}
                              className="w-full h-full"
                              transition={{ duration: TRANSITION_DURATION * 0.5, ease: EASE_CURVE }}
                            >
                              {consultant.isImage ? (
                                <img src={consultant.avatar} alt={consultant.name} className="w-full h-full object-cover" />
                              ) : (
                                consultant.avatar
                              )}
                            </motion.div>
                          ) : (
                            // Placeholder while avatar is morphing
                            <div className="w-full h-full bg-slate-700/50" />
                          )}
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-1 text-center">
                          {consultant.name}
                        </h2>
                        <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-400 text-center">
                          {consultant.title}
                        </p>
                      </div>

                      {/* Tagline */}
                      <div className="mb-4">
                        <p className="text-slate-300 italic text-sm">
                          &ldquo;{consultant.tagline}&rdquo;
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-slate-300 mb-8 flex-1 leading-relaxed">
                        {consultant.description}
                      </p>

                      {/* Traits */}
                      <div className="mb-8 grid grid-cols-2 gap-2">
                        {consultant.traits.map((trait) => (
                          <div key={trait.label} className="bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-400">{trait.label}</p>
                            <p className="text-sm font-medium text-white">{trait.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => handleSelect(consultant.name)}
                        disabled={transitioning}
                        className={`w-full bg-gradient-to-r ${consultant.color} hover:from-teal-600 hover:to-teal-500 text-white font-semibold py-6 transition-all`}
                      >
                        Meet {consultant.name}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>

        {/* Footer Note */}
        <AnimatePresence>
          {!transitioning && (
            <motion.div
              className="mt-16 text-center"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-slate-400 text-sm">
                You can also switch consultants anytime in a new conversation
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

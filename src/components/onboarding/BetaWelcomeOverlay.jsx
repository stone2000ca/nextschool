import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BetaWelcomeOverlay({ onDismiss }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this before (within this session)
    const dismissed = sessionStorage.getItem('betaWelcomeDismissed');
    if (!dismissed) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('betaWelcomeDismissed', 'true');
    setShow(false);
    if (onDismiss) onDismiss();
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-slate-400" />
        </button>

        {/* Beta badge */}
        <div className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          BETA
        </div>

        {/* Welcome heading */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Welcome to NextSchool
        </h1>

        {/* Description */}
        <p className="text-slate-600 mb-6 leading-relaxed">
          We're an AI-powered education consultant helping parents find the perfect private school. Pick your consultant to get started.
        </p>

        {/* Consultant preview */}
        <div className="space-y-3 mb-8">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 mb-1">👩‍💼 Jackie</p>
            <p className="text-xs text-slate-600">Warm & supportive approach</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 mb-1">👨‍💼 Liam</p>
            <p className="text-xs text-slate-600">Direct & strategic approach</p>
          </div>
        </div>

        {/* Beta note */}
        <p className="text-xs text-slate-500 mb-6 text-center">
          NextSchool is currently in beta. <br />
          We'd love your feedback!
        </p>

        {/* Dismiss button */}
        <Button
          onClick={handleDismiss}
          className="w-full bg-teal-600 hover:bg-teal-700"
        >
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  );
}
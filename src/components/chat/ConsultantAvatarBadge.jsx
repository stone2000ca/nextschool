'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CONSULTANT_AVATARS } from '@/lib/brand-assets';

/**
 * Persistent consultant avatar badge — top-left corner.
 * Uses layoutId="consultant-avatar" so framer-motion auto-animates
 * the position/size morph from the selection card.
 */
export default function ConsultantAvatarBadge({ consultant, className = '', onClick }) {
  const shouldReduceMotion = useReducedMotion();

  if (!consultant) return null;

  const avatar = CONSULTANT_AVATARS[consultant];
  const accentColor = consultant === 'Jackie' ? '#C27B8A' : '#6B9DAD';

  return (
    <motion.div
      layoutId="consultant-avatar"
      className={`z-50 flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="w-10 h-10 rounded-full overflow-hidden ring-2 shadow-lg"
        style={{ ringColor: accentColor, boxShadow: `0 0 12px ${accentColor}40` }}
      >
        <img
          src={avatar}
          alt={consultant}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="text-sm font-semibold text-white/90">{consultant}</span>
    </motion.div>
  );
}

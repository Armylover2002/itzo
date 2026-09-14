import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@food/utils/utils';

/**
 * GlassCard - A premium container with glassmorphism effects.
 */
export const GlassCard = ({ children, className, priority = 'normal', ...props }) => {
  const priorities = {
    normal: 'bg-neutral-900/60 backdrop-blur-xl border-white/5',
    high: 'bg-red-500/10 backdrop-blur-2xl border-red-500/30',
    urgent: 'bg-red-500/10 backdrop-blur-2xl border-red-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-[2.5rem] border p-6 shadow-2xl',
        priorities[priority],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

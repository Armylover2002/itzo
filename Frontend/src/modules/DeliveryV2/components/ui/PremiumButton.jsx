import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@food/utils/utils';

/**
 * PremiumButton - A State-of-the-Art button for Delivery V2
 * Includes hover haptics (visual), glass effects and smooth transitions.
 * 
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'glass' | 'danger'} props.variant
 * @param {'sm' | 'md' | 'lg' | 'full'} props.size
 * @param {boolean} props.isLoading
 */
export const PremiumButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className,
  icon: Icon,
  ...props
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20',
    secondary: 'bg-neutral-800 text-white hover:bg-neutral-700',
    glass: 'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20',
    danger: 'bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-xl',
    md: 'px-6 py-3 text-base rounded-2xl',
    lg: 'px-8 py-4 text-lg rounded-3xl font-bold',
    full: 'w-full py-4 text-lg rounded-3xl font-bold',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'relative flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:grayscale',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
        />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
        </>
      )}
      
      {/* Premium Shine Effect */}
      <motion.div
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] pointer-events-none"
      />
    </motion.button>
  );
};

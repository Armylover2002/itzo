import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Receipt } from 'lucide-react';
import { EYEBROW, HEADING } from './typography';

const PROMISES = [
  {
    id: 'offline-prices',
    title: 'Offline Prices,\nOnline Convenience',
    desc: 'Pay what you see in the restaurant menu. Zero hidden menu markups — guaranteed.',
    image: '/food/promise/offline_prices.png',
    badge: '📜 100% Menu Price Match',
    badgePosition: 'top-3 right-3',
    alt: 'Offline Prices, Online Convenience',
  },
  {
    id: 'lowest-prices',
    title: 'Lowest Prices\nof Items',
    desc: 'Dishes start at ₹49 & most are under ₹250! Pocket-friendly meals for everyone.',
    image: '/food/promise/lowest_prices.png',
    badge: '✨ ₹49 • ₹69 • ₹99',
    badgePosition: 'top-3 right-3',
    alt: 'Lowest Prices of Items',
  },
  {
    id: 'superfast-delivery',
    title: 'Superfast Live\nDelivery',
    desc: 'Piping hot food delivered in minutes with real-time GPS tracking & tamper-proof seal.',
    image: '/food/promise/superfast_delivery.png',
    badge: '⚡ Live GPS Tracking',
    badgePosition: 'top-3 left-3',
    alt: 'Superfast Live Delivery',
  },
];

const PromiseCard = React.memo(function PromiseCard({
  title,
  desc,
  image,
  badge,
  badgePosition,
  alt,
  index,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      whileHover={{ y: -8 }}
      className="group relative rounded-[2.2rem] overflow-hidden p-7 md:p-8 bg-gradient-to-br from-[#ff7e2b] via-[#FB4F01] to-[#d64300] shadow-[0_20px_45px_rgba(254,85,2,0.25)] transition-all duration-300 hover:shadow-[0_28px_65px_rgba(254,85,2,0.42)] flex flex-col justify-between border border-white/20"
    >
      {/* Decorative background shapes */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <Sparkles className="absolute -top-4 -right-4 w-32 h-32 text-white rotate-12" strokeWidth={1} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_100%,white_1px,transparent_1px)] bg-[length:14px_14px]" />
      </div>

      {/* Moving shine sweep across the card on hover */}
      <motion.div
        animate={{ x: ['-140%', '240%'] }}
        transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
        className="absolute top-0 left-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-20"
      />

      {/* 3D Character Illustration Area */}
      <div className="relative w-full h-56 md:h-64 flex items-center justify-center mb-6">
        {/* Soft radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22)_0%,transparent_70%)] rounded-3xl pointer-events-none" />

        {/* Floating pill badge */}
        {badge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 }}
            className={`absolute ${badgePosition} z-20 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-black shadow-lg tracking-wide`}
          >
            {badge}
          </motion.div>
        )}

        {/* 3D Character with floating motion */}
        <motion.img
          src={image}
          alt={alt}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.25 }}
          className="relative z-10 max-h-full max-w-[90%] object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.28)] select-none pointer-events-none transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Text Details */}
      <div className="relative z-10">
        <h3 className="text-white text-[24px] md:text-[28px] font-black leading-[1.18] mb-3 whitespace-pre-line tracking-tight">
          {title}
        </h3>
        <p className="text-white/90 text-sm md:text-base font-medium leading-relaxed max-w-[28ch]">
          {desc}
        </p>
      </div>
    </motion.div>
  );
});

/**
 * "The ItzoFood Promise" — upgraded cards with 3D Pixar-styled character
 * illustrations matching the user's reference, in signature orange gradient.
 */
const PromiseSection = React.memo(function PromiseSection() {
  return (
    <section className="relative w-full bg-white py-20 md:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`mb-5 ${EYEBROW}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Our promise
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className={`${HEADING} mb-14 md:mb-16 max-w-2xl`}
        >
          The ItzoFood Promise
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PROMISES.map((p, i) => (
            <PromiseCard key={p.id} {...p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
});

export default PromiseSection;

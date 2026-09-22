import React from 'react';
import { motion } from 'framer-motion';
import { PackageCheck, ReceiptText, HeartHandshake, Sparkles } from 'lucide-react';
import { EYEBROW, HEADING } from './typography';

const PROMISES = [
  {
    icon: PackageCheck,
    title: 'Fresh, sealed\n& secure',
    desc: 'Every order is packed with care and tamper-sealed for a safe journey to your door.',
  },
  {
    icon: ReceiptText,
    title: 'Clear, upfront\npricing',
    desc: 'See your complete bill before you pay — no last-minute surprises at checkout.',
  },
  {
    icon: HeartHandshake,
    title: 'Support that\nactually cares',
    desc: 'Real help, right when you need it — before, during and after every order.',
  },
];

const PromiseCard = React.memo(function PromiseCard({ icon: Icon, title, desc, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      whileHover={{ y: -8 }}
      className="relative rounded-[2rem] overflow-hidden p-8 md:p-9 bg-gradient-to-br from-[#ff7e2b] via-[#fe5502] to-[#d64300] shadow-[0_20px_45px_rgba(254,85,2,0.25)] transition-shadow duration-300 hover:shadow-[0_25px_60px_rgba(254,85,2,0.4)]"
    >
      {/* Decorative background shapes, matching the section's playful/torn-paper feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]">
        <Sparkles className="absolute -top-4 -right-4 w-32 h-32 text-white rotate-12" strokeWidth={1} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_100%,white_1px,transparent_1px)] bg-[length:14px_14px]" />
      </div>

      <div className="relative z-10">
        <h3 className="text-white text-[28px] md:text-[32px] font-black leading-[1.15] mb-3 whitespace-pre-line">
          {title}
        </h3>
        <p className="text-white/85 text-base font-medium leading-relaxed mb-10 max-w-[26ch]">
          {desc}
        </p>

        {/* Glossy icon badge with a moving shine, animated float */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
          className="relative w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center overflow-hidden"
        >
          <motion.div
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
            className="absolute top-0 left-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <Icon className="w-11 h-11 md:w-12 md:h-12 text-white relative z-10" strokeWidth={1.5} />
        </motion.div>
      </div>
    </motion.div>
  );
});

/**
 * "The ItzoFood Promise" — a set of trust/UX promises in our own primary-orange
 * theme. Deliberately generic, true-by-design claims (packaging, pricing
 * transparency, support) rather than specific numeric/fee guarantees, since
 * those would need to match real backend fee settings to stay honest.
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
            <PromiseCard key={p.title} {...p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
});

export default PromiseSection;

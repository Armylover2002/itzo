import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, Sparkles, ArrowRight, Crown } from 'lucide-react';

const BENEFITS = [
  { emoji: '🎟️', title: 'Free delivery', desc: 'On eligible nearby orders' },
  { emoji: '🛵', title: 'Extra discounts', desc: 'At partner restaurants' },
  { emoji: '⚡', title: 'Priority support', desc: 'Jump the queue, always' },
];

const SPARKLE_POSITIONS = [
  { className: 'top-[6%] left-[10%] md:left-[22%]', size: 16, delay: 0 },
  { className: 'top-[14%] right-[8%] md:right-[22%]', size: 12, delay: 0.9 },
  { className: 'bottom-[10%] left-[6%] md:left-[18%]', size: 14, delay: 1.6 },
  { className: 'bottom-[18%] right-[6%] md:right-[18%]', size: 18, delay: 0.4 },
];

const GoldSection = React.memo(function GoldSection() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full bg-black py-20 md:py-28 flex flex-col items-center overflow-hidden font-sans">

      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute -bottom-[30%] -left-[10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FE5502]/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FE5502]/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4">

        {/* Wordmark */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-white text-3xl md:text-4xl font-black italic tracking-tighter mb-10 md:mb-14"
        >
          itzofood
        </motion.h2>

        {/* Ambient sparkles around the membership card */}
        <div className="absolute inset-0 pointer-events-none hidden md:block">
          {SPARKLE_POSITIONS.map((s, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
              className={`absolute ${s.className}`}
            >
              <Sparkles size={s.size} className="text-[#ffb37a]" />
            </motion.div>
          ))}
        </div>

        {/* Membership "ticket" card — the centrepiece, replacing the old plain
            text + icon-grid layout with a single distinctive product visual. */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: -3 }}
          whileInView={{ opacity: 1, y: 0, rotate: -3 }}
          viewport={{ once: true }}
          whileHover={{ rotate: 0, scale: 1.015 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 80 }}
          className="relative w-full max-w-md p-[1.5px] rounded-[2rem] bg-gradient-to-br from-[#ffb37a] via-[#FE5502]/60 to-[#8a2c00]/40 shadow-[0_25px_70px_rgba(254,85,2,0.25)]"
        >
          <div className="relative rounded-[calc(2rem-1.5px)] bg-gradient-to-b from-[#1c0f06] to-black overflow-hidden px-8 pt-8 pb-7">

            {/* Shine sweep */}
            <motion.div
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              className="absolute top-0 left-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
            />

            {/* Badge row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#FE5502]/15 border border-[#FE5502]/40 flex items-center justify-center">
                <Crown className="w-4 h-4 text-[#FE5502]" />
              </div>
              <span className="text-white/70 text-xs font-bold tracking-[0.25em] uppercase">Membership</span>
            </div>

            {/* PRO */}
            <div className="relative text-[64px] md:text-[80px] font-black tracking-widest leading-none mb-2">
              <motion.span
                animate={{ backgroundPositionX: ['0%', '200%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                style={{ backgroundSize: '200% 100%' }}
                className="bg-gradient-to-r from-[#8a2c00] via-[#ffb37a] to-[#8a2c00] bg-clip-text text-transparent"
              >
                PRO
              </motion.span>
            </div>

            <p className="text-[#FE5502] text-base font-medium leading-relaxed mb-6 max-w-[280px]">
              A membership built for everyday food lovers
            </p>

            {/* Ticket-style perforated divider */}
            <div className="relative border-t-2 border-dashed border-white/15 my-2">
              <span className="absolute -left-8 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black" />
              <span className="absolute -right-8 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black" />
            </div>

            {/* Benefits list */}
            <div className="mt-4 flex flex-col">
              {BENEFITS.map((benefit, i) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`flex items-center gap-4 py-3.5 ${i < BENEFITS.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#1a0e05] flex items-center justify-center border border-[#FE5502]/30 flex-shrink-0">
                    <span className="text-xl">{benefit.emoji}</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-white text-base font-bold leading-tight">{benefit.title}</span>
                    <span className="text-white/50 text-sm font-medium">{benefit.desc}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/user/auth/signup')}
              className="group mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff7800] to-[#e64a00] text-white text-base font-bold shadow-[0_10px_25px_rgba(255,120,0,0.3)]"
            >
              Join PRO
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </div>
        </motion.div>

        {/* Small trust row under the card */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-1.5 mt-7 text-white/40 text-sm font-medium"
        >
          <Star className="w-4 h-4 text-[#FE5502] fill-[#FE5502]" />
          Loved by foodies who order often
        </motion.div>
      </div>
    </div>
  );
});

export default GoldSection;

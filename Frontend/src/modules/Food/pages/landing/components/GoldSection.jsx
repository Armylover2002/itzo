import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const GoldSection = React.memo(function GoldSection() {
  return (
    <div className="relative w-full bg-black py-20 md:py-28 flex flex-col items-center overflow-hidden font-sans">
      
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute -bottom-[30%] -left-[10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl" />

        {/* Subtle geometric lines */}
        <svg className="absolute bottom-0 left-0 w-64 h-64 text-primary/20 transform -translate-x-1/2 translate-y-1/2" viewBox="0 0 100 100">
          <polygon points="50,0 100,50 50,100 0,50" fill="none" stroke="currentColor" strokeWidth="1"/>
          <polygon points="50,20 80,50 50,80 20,50" fill="none" stroke="currentColor" strokeWidth="1"/>
          <polygon points="50,40 60,50 50,60 40,50" fill="none" stroke="currentColor" strokeWidth="1"/>
        </svg>
        <svg className="absolute bottom-0 right-0 w-64 h-64 text-primary/20 transform translate-x-1/2 translate-y-1/2" viewBox="0 0 100 100">
          <polygon points="50,0 100,50 50,100 0,50" fill="none" stroke="currentColor" strokeWidth="1"/>
          <polygon points="50,20 80,50 50,80 20,50" fill="none" stroke="currentColor" strokeWidth="1"/>
          <polygon points="50,40 60,50 50,60 40,50" fill="none" stroke="currentColor" strokeWidth="1"/>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4">
        
        {/* Logo */}
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-white text-4xl md:text-5xl font-black italic tracking-tighter mb-1 md:mb-2"
        >
          itzofood
        </motion.h2>

        {/* PRO Typography */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center justify-center text-[70px] md:text-[140px] font-black tracking-widest bg-gradient-to-b from-[#ffb37a] via-primary to-[#8a2c00] bg-clip-text text-transparent leading-none mb-6 drop-shadow-[0_10px_30px_rgba(254,85,2,0.2)]"
        >
          PRO
        </motion.div>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-primary text-xl md:text-[22px] text-center font-medium leading-relaxed mb-12 md:mb-16 max-w-sm"
        >
          A membership built for<br/>everyday food lovers
        </motion.p>

        {/* Benefits Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-4 mb-10 md:mb-14"
        >
          <Star className="w-5 h-5 md:w-6 md:h-6 text-primary fill-primary" />
          <h3 className="text-white text-lg md:text-xl font-bold tracking-[0.2em] md:tracking-[0.25em]">PRO BENEFITS</h3>
          <Star className="w-5 h-5 md:w-6 md:h-6 text-primary fill-primary" />
        </motion.div>

        {/* Benefits Grid */}
        <div className="flex flex-col md:flex-row gap-10 md:gap-24 w-full justify-center px-4">
          
          {/* Benefit 1 */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 md:gap-6"
          >
            <div className="w-20 h-20 rounded-full bg-[#1a0e05] flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(254,85,2,0.15)] flex-shrink-0">
               <span className="text-[40px] drop-shadow-md">🎟️</span>
            </div>
            <div className="flex flex-col justify-center h-full pt-1 md:pt-2">
               <h4 className="text-white text-xl md:text-[24px] font-bold mb-1 md:mb-2 leading-tight">Free delivery</h4>
               <p className="text-primary/80 text-base md:text-[17px] font-medium leading-snug">On eligible nearby orders</p>
            </div>
          </motion.div>
          
          {/* Benefit 2 */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 md:gap-6"
          >
            <div className="w-20 h-20 rounded-full bg-[#1a0e05] flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(254,85,2,0.15)] flex-shrink-0">
               <span className="text-[40px] drop-shadow-md">🛵</span>
            </div>
            <div className="flex flex-col justify-center h-full pt-1 md:pt-2">
               <h4 className="text-white text-xl md:text-[24px] font-bold mb-1 md:mb-2 leading-tight">Extra discounts</h4>
               <p className="text-primary/80 text-base md:text-[17px] font-medium leading-snug">At partner restaurants</p>
            </div>
          </motion.div>

        </div>

      </div>
    </div>
  );
});

export default GoldSection;

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Clock, 
  ArrowRight, 
  Star, 
  ArrowUpRight,
  Zap,
  TrendingUp,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ExperienceBannerCarousel from './ExperienceBannerCarousel';
import QuickCategories from './QuickCategories';
import ProductRail from './shared/ProductRail';
import QuickHeader from './QuickHeader';
import { useQuickLocation } from '../context/LocationContext';
import { ProductDetailProvider } from '../context/ProductDetailContext';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { CartAnimationProvider } from '../context/CartAnimationContext';

// Background patterns
const PremiumBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
    {/* Animated Mesh Gradients */}
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#DCFCE7] dark:bg-[#064e3b] rounded-full blur-[120px] opacity-20 animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#EFF6FF] dark:bg-[#1e3a8a] rounded-full blur-[120px] opacity-20" />
    <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[#FEF9C3] dark:bg-[#713f12] rounded-full blur-[100px] opacity-15" />
    
    {/* Subtle texture grid */}
    <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
  </div>
);

const PremiumFloatingElements = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden h-[2000px]">
    <motion.div 
      animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-40 right-[10%] opacity-10 dark:opacity-20"
    >
      <ShoppingBag size={120} strokeWidth={0.5} />
    </motion.div>
    <motion.div 
      animate={{ y: [0, 30, 0], rotate: [0, -8, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      className="absolute top-[800px] left-[5%] opacity-5 dark:opacity-10"
    >
      <Star size={180} strokeWidth={0.3} />
    </motion.div>
    <motion.div 
      animate={{ y: [0, -40, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      className="absolute top-[1500px] right-[15%] opacity-10 dark:opacity-15"
    >
      <Clock size={100} strokeWidth={0.5} />
    </motion.div>
  </div>
);

const MarqueeItem = ({ text }) => (
  <div className="flex items-center gap-6 px-4 shrink-0">
    <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-sm">{text}</span>
    <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
  </div>
);

export default function QuickHomeView({
  banners = [],
  categories = [],
  rails = [],
  activeCategory = null,
  setActiveCategory,
  onProductClick,
  embed = false,
  preserveHeader = false,
}) {
  const { location } = useQuickLocation();
  const [activeStat, setActiveStat] = useState(0);
  const [showInlineFullHeader] = useState(true);

  const stats = [
    { label: "Blink Delivery", value: "9 Mins", icon: <Zap size={14} />, color: "from-amber-400 to-red-500" },
    { label: "Quality Assured", value: "Verified", icon: <ShieldCheck size={14} />, color: "from-emerald-400 to-green-600" },
    { label: "Pro Priority", value: "Active", icon: <TrendingUp size={14} />, color: "from-blue-400 to-indigo-600" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStat((prev) => (prev + 1) % stats.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f8fafc] dark:bg-[#0a0a0a] font-outfit transition-colors duration-500">
      <PremiumBackground />
      <PremiumFloatingElements />
      
      {/* Dynamic Top Header for Embedded View */}
      <div className="-mt-3 md:mt-0 relative z-[100]">
        <QuickHeader 
          categories={categories} 
          activeCategory={activeCategory} 
          onCategorySelect={setActiveCategory} 
          isEmbedded={embed && !preserveHeader}
          isInline={showInlineFullHeader}
        />
      </div>

      <main className={cn("relative z-10 mx-auto max-w-[1700px] px-6 pt-6 text-[#1a1c1e] dark:text-white/90 md:px-10")}>
        
        {/* Cinematic Hero Section */}
        <section className="mb-14 overflow-hidden rounded-[48px] bg-white dark:bg-[#111] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.12)] border border-white dark:border-white/5 relative">
          <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-[#0c831f]/10 to-transparent pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Carousel Content */}
            <div className="lg:col-span-8 p-1 relative z-10">
               <ExperienceBannerCarousel items={banners} fullWidth={false} slideGap={12} />
               <div className="absolute inset-0 bg-gradient-to-r from-white dark:from-[#111] via-transparent to-transparent pointer-events-none z-20 w-32" />
            </div>

            {/* Premium Stats/Meta Info */}
            <div className="lg:col-span-4 flex flex-col justify-center p-10 lg:p-14 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
               <div className="mb-10">
                  <h1 className="text-[38px] lg:text-[46px] font-black leading-[1.1] tracking-tight mb-4 uppercase italic">
                    The <span className="text-[#0c831f] underline decoration-4 underline-offset-8">Fastest</span><br />Grocery <span className="opacity-40">Store</span>
                  </h1>
                  <p className="text-lg font-medium text-slate-500 dark:text-slate-400">Experience premium shopping with doorstep delivery in 9 minutes flat.</p>
               </div>

               <div className="flex flex-col gap-5">
                  {stats.map((stat, i) => (
                    <motion.div 
                      key={stat.label}
                      initial={false}
                      animate={{ 
                        scale: activeStat === i ? 1.05 : 1,
                        x: activeStat === i ? 10 : 0
                      }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500",
                        activeStat === i 
                          ? "bg-white dark:bg-[#1a1a1a] border-[#0c831f]/20 shadow-xl shadow-[#0c831f]/5" 
                          : "bg-transparent border-transparent opacity-60"
                      )}
                    >
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg", stat.color)}>
                        {stat.icon}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#0c831f]">{stat.label}</div>
                        <div className="text-xl font-black">{stat.value}</div>
                      </div>
                    </motion.div>
                  ))}
               </div>
            </div>
          </div>
        </section>

        {/* Categories Rail */}
        <div id="all-categories">
          <QuickCategories categories={categories} />
        </div>

        {/* Premium Marquee */}
        <div className="mt-20 overflow-hidden py-4 -mx-[10vw]">
          <div className="flex bg-[#0c831f] shadow-lg py-5 px-4 transform -rotate-1 relative z-20 overflow-hidden border-y-4 border-emerald-300/30">
            {/* Gloss wave */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_infinite] -skew-x-12" />
            
            <motion.div 
               animate={{ x: [0, -1000] }}
               transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
               className="flex whitespace-nowrap"
            >
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex">
                  <MarqueeItem text="Premium Quality" />
                  <MarqueeItem text="10 Minute Delivery" />
                  <MarqueeItem text="Farm Fresh" />
                  <MarqueeItem text="Verified Stores" />
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Product Rails */}
        <div className="mt-24 space-y-24 pb-40">
          {rails.map((rail, idx) => (
            <motion.section 
              key={rail.id || idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="mb-10 flex items-center justify-between px-2">
                <div className="flex items-center gap-5">
                   <div className="h-10 w-3 rounded-full bg-gradient-to-b from-[#0c831f] to-emerald-300" />
                   <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl italic">
                    {rail.title}
                   </h2>
                </div>
                <motion.button 
                  whileHover={{ x: 5 }}
                  className="group flex items-center gap-2 text-base font-bold text-[#0c831f] hover:text-[#0b6d19] transition-colors"
                >
                  View All <ArrowRight size={18} className="transition-transform group-hover:rotate-[-45deg]" />
                </motion.button>
              </div>
              
              <ProductRail
                products={rail.products}
                onProductClick={onProductClick}
              />
            </motion.section>
          ))}
        </div>

        {/* Premium Member Upsell Section */}
        <section className="mb-32 overflow-hidden rounded-[60px] bg-[#111] p-12 lg:p-20 relative text-white">
           {/* Abstract blurs */}
           <div className="absolute top-0 right-0 w-96 h-96 bg-[#0c831f] rounded-full blur-[140px] opacity-30" />
           <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500 rounded-full blur-[120px] opacity-20" />
           
           <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
              <div className="mb-8 flex items-center gap-3 rounded-full bg-white/10 px-6 py-2 backdrop-blur-xl border border-white/20">
                 <Star className="text-yellow-400 fill-yellow-400" size={16} />
                 <span className="text-xs font-black uppercase tracking-[0.3em]">Exclusive Membership</span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black mb-8 leading-tight tracking-tight uppercase">Unlock the <span className="text-[#0c831f]">Golden</span> Standard</h2>
              <p className="text-xl text-white/60 mb-12 font-medium">Join 2M+ members and get unlimited free deliveries, surprise gifts, and early access to drops.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-16">
                 {[
                   { label: "Free Delivery", val: "Unlimited", desc: "For all orders above \u20b999" },
                   { label: "Cashback", val: "Flat 5%", desc: "On every single purchase" },
                   { label: "Surprise Drops", val: "Bimonthly", desc: "Exclusive curated boxes" },
                 ].map((box) => (
                   <div key={box.label} className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/[0.08] transition-all">
                      <div className="text-[10px] font-bold text-[#0c831f] uppercase tracking-widest mb-2">{box.label}</div>
                      <div className="text-3xl font-black mb-2">{box.val}</div>
                      <div className="text-xs text-white/40">{box.desc}</div>
                   </div>
                 ))}
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative flex items-center gap-4 rounded-full bg-[#0c831f] px-12 py-6 text-xl font-black shadow-2xl shadow-[#0c831f]/40 hover:bg-[#0b6d19] transition-all"
              >
                Become a Member <ArrowUpRight className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </motion.button>
           </div>
        </section>

        {/* Better Trust Section */}
        <section className="mb-20 grid grid-cols-1 md:grid-cols-4 gap-12 border-t border-slate-100 dark:border-white/5 pt-20">
           {[
             { title: "Safe Payments", desc: "100% Secure checkouts", icon: "???" },
             { title: "Curated Items", desc: "Source from trusted farms", icon: "???" },
             { title: "Eco-Friendly", desc: "Responsible packaging", icon: "???" },
             { title: "24/7 Support", desc: "Always here to help", icon: "???" },
           ].map((trust) => (
             <div key={trust.title} className="flex items-start gap-4">
               <div className="text-3xl">{trust.icon}</div>
               <div>
                 <div className="font-black uppercase tracking-wider text-xs mb-1 dark:text-white">{trust.title}</div>
                 <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{trust.desc}</div>
               </div>
             </div>
           ))}
        </section>

      </main>

      {/* Background Orbs */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-1/4 h-1/4 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-[120px] opacity-30" />
      </div>
    </div>
  );
}

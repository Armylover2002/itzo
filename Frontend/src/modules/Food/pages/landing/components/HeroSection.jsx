import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star, Bike, MapPin } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

// Decorative glass cards that sit over the right side of the hero on desktop —
// purely visual (no factual/numeric claims), they give the hero a "product shot"
// feel instead of plain centered text on a photo.
const FLOATING_CARDS = [
  { icon: Star, label: 'Loved by foodies', className: 'top-[16%] right-[6%]', rotate: -6, delay: 0 },
  { icon: Bike, label: 'Fast doorstep delivery', className: 'top-[46%] right-[1%]', rotate: 4, delay: 0.8 },
  { icon: MapPin, label: 'Live order tracking', className: 'top-[74%] right-[10%]', rotate: -3, delay: 1.5 },
];

const HeroSection = React.memo(function HeroSection({ navigate }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      let currentSettings = getCachedSettings();
      if (!currentSettings) {
        currentSettings = await loadBusinessSettings();
      }
      if (mounted) {
        setSettings(currentSettings);
      }
    };
    fetchSettings();

    const handleUpdate = (e) => {
      if (mounted) {
        setSettings(e?.detail || getCachedSettings());
      }
    };
    window.addEventListener('businessSettingsUpdated', handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener('businessSettingsUpdated', handleUpdate);
    };
  }, []);

  // Use the admin video if available, else fallback to business settings video
  const videoUrl = settings?.landingVideo?.url || "";
  const posterUrl = settings?.landingPoster?.url || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop";
  const appName = settings?.landingHeroTitle || "ItzoFood";
  const appSubtitle = settings?.landingHeroSubtitle || "Great food,\ndelivered to your door";
  const appStoreImg = settings?.landingAppStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg";
  const playStoreImg = settings?.landingPlayStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";
  const playStoreUrl = settings?.playStoreLink || "#!";
  const appStoreUrl = settings?.appStoreLink || "#!";

  return (
    <div className="relative h-screen min-h-[640px] w-full flex flex-col overflow-hidden bg-gradient-to-br from-[#2a1206] via-[#1a0e08] to-[#0d0704]">

      {/* Background Wrapper */}
      <div className="absolute inset-0 z-0">
        {videoUrl ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={posterUrl}
            onLoadedData={() => setIsLoaded(true)}
            // If the uploaded video fails to load, still fade in — the poster
            // frame (or, once opacity is up, the browser's own fallback) shows
            // instead of leaving the hero blank.
            onError={() => setIsLoaded(true)}
            className={`object-cover w-full h-full transition-opacity duration-[1400ms] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : (
          <img
            src={posterUrl}
            alt="Background"
            onLoad={() => setIsLoaded(true)}
            className={`object-cover w-full h-full transition-opacity duration-[1400ms] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {/* Dark only over the text column; fades out well before the right edge
            so the video/photo itself stays vibrant and visible there instead of
            getting washed out under a flat overlay. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(100deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.86) 28%, rgba(0,0,0,0.55) 46%, rgba(0,0,0,0.15) 66%, rgba(0,0,0,0.05) 82%)',
          }}
        />
        {/* Light top/bottom vignette only — keeps the navbar and the fade into
            the marquee readable without dimming the whole frame. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.5) 100%)',
          }}
        />

        {/* Soft glow blobs for depth (purely decorative, animate slowly) */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[#FE5502]/25 blur-[110px]"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 -right-24 w-[460px] h-[460px] rounded-full bg-orange-500/10 blur-[120px]"
        />
      </div>

      {/* Floating "product shot" glass cards — desktop only, right side */}
      <div className="hidden lg:block absolute inset-0 z-10 pointer-events-none">
        {FLOATING_CARDS.map(({ icon: Icon, label, className, rotate, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 30, rotate }}
            animate={{ opacity: 1, y: 0, rotate }}
            transition={{ duration: 0.8, delay: 0.9 + delay * 0.15 }}
            className={`absolute ${className}`}
          >
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
              style={{ rotate }}
              className="flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] pl-3 pr-5 py-3"
            >
              <div className="w-9 h-9 rounded-full bg-[#FE5502]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-[18px] h-[18px] text-[#FE5502]" strokeWidth={2.25} />
              </div>
              <span className="text-slate-800 text-sm font-bold whitespace-nowrap">{label}</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Hero Content — left aligned on desktop so the frame reads as
          text + visual rather than centered text over a photo */}
      <div className="relative z-20 flex-1 w-full flex items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center lg:items-start text-center lg:text-left"
        >
          {/* Eyebrow badge */}
          <motion.div
            variants={itemVariants}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-white/90 text-sm font-semibold tracking-wide"
          >
            <Sparkles className="w-4 h-4 text-[#FE5502]" />
            India&apos;s favourite way to order food
          </motion.div>

          {/* Logo Text */}
          <motion.h1
            variants={itemVariants}
            className="text-6xl md:text-7xl lg:text-[88px] font-black italic tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] mb-6"
          >
            {appName.toLowerCase() === 'itzofood' ? (
              <>
                <span className="text-[#ff7800]">i</span>
                <span className="text-white">tz</span>
                <span className="text-[#ff7800]">o</span>
                <span className="text-white">food</span>
              </>
            ) : (
              <span className="text-white">{appName.toLowerCase()}</span>
            )}
          </motion.h1>

          {/* Heading */}
          <motion.h2
            variants={itemVariants}
            className="text-white text-4xl md:text-5xl lg:text-[60px] font-bold leading-tight drop-shadow-xl mb-6 whitespace-pre-line max-w-2xl"
          >
            {appSubtitle}
          </motion.h2>

          {/* Subheading */}
          <motion.p
            variants={itemVariants}
            className="text-gray-200 text-lg md:text-[22px] font-medium drop-shadow-md mb-10 max-w-xl leading-snug"
          >
            Experience fast &amp; easy online ordering on the {appName} app
          </motion.p>

          {/* Primary CTA + App Download Buttons */}
          <motion.div variants={itemVariants} className="flex flex-col items-center lg:items-start gap-6 w-full">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 12px 30px rgba(255,120,0,0.45)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/food/user')}
                className="px-8 py-3.5 rounded-full bg-[#FE5502] text-white text-lg font-semibold shadow-[0_8px_24px_rgba(255,120,0,0.35)] transition-colors hover:bg-[#e56800]"
              >
                Order food now
              </motion.button>
              <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={playStoreImg}
                  alt="Get it on Google Play"
                  className="h-12 md:h-[52px] object-contain cursor-pointer hover:scale-105 transition-transform"
                />
              </a>
              <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={appStoreImg}
                  alt="Download on the App Store"
                  className="h-12 md:h-[52px] object-contain cursor-pointer hover:scale-105 transition-transform"
                />
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade so the hero blends into the dark marquee strip that follows,
          instead of ending on a hard edge. */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#150a05] pointer-events-none" />
    </div>
  );
});

export default HeroSection;

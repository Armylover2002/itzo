import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';
import api from '@/services/api';

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
    
    // Removed legacy fetchAdminVideo that overridden the premium settings
    
    return () => { 
      mounted = false; 
      window.removeEventListener('businessSettingsUpdated', handleUpdate);
    };
  }, []);

  // Use the admin video if available, else fallback to business settings video
  const videoUrl = settings?.landingVideo?.url || "";
  const posterUrl = settings?.landingPoster?.url || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop";
  const appName = settings?.landingHeroTitle || "ItzoFood";
  const appSubtitle = settings?.landingHeroSubtitle || "India's #1\nfood delivery app";
  const appStoreImg = settings?.landingAppStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg";
  const playStoreImg = settings?.landingPlayStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";
  const playStoreUrl = settings?.playStoreLink || "#!";
  const appStoreUrl = settings?.appStoreLink || "#!";

  return (
    <div className="relative h-screen w-full flex flex-col items-center justify-center bg-gray-900 overflow-hidden">
      
      {/* Background Wrapper */}
      <div className="absolute inset-0 z-0 bg-gray-900">
        {videoUrl ? (
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            preload="metadata"
            poster={posterUrl}
            onLoadedData={() => setIsLoaded(true)}
            className={`object-cover w-full h-full transition-opacity duration-1000 ${isLoaded ? 'opacity-90' : 'opacity-0'}`}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : (
          <img 
            src={posterUrl} 
            alt="Background" 
            onLoad={() => setIsLoaded(true)}
            className={`object-cover w-full h-full transition-opacity duration-1000 ${isLoaded ? 'opacity-90' : 'opacity-0'}`}
          />
        )}
        {/* Dark overlay to make text readable */}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      {/* Hero Content */}
      <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col items-center text-center -mt-10">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          {/* Logo Text */}
          <h1 className="text-6xl md:text-7xl lg:text-[80px] font-black italic tracking-tighter drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)] mb-8">
            {appName.toLowerCase() === 'itzofood' ? (
              <>
                <span className="text-[#ff7800]">i</span>
                <span className="text-[#0f172a]">tz</span>
                <span className="text-[#ff7800]">o</span>
                <span className="text-[#0f172a]">food</span>
              </>
            ) : (
              <span className="text-[#0f172a]">{appName.toLowerCase()}</span>
            )}
          </h1>

          {/* Heading */}
          <h2 className="text-white text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight drop-shadow-xl mb-6 whitespace-pre-line">
            {appSubtitle}
          </h2>

          {/* Subheading */}
          <p className="text-gray-100 text-xl md:text-[22px] font-medium drop-shadow-md mb-10 max-w-2xl leading-snug">
            Experience fast & easy online ordering<br/>on the {appName} app
          </p>

          {/* App Download Buttons */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-5">
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
      </div>

    </div>
  );
});

export default HeroSection;

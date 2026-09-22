import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';
import { EYEBROW, HEADING, BODY } from './typography';

const CTASection = React.memo(function CTASection() {
  const [settings, setSettings] = React.useState(null);

  React.useEffect(() => {
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

  const qrCodeImg = settings?.landingQrCodeImage?.url || "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://itzofood.com/app&color=000000&bgcolor=ffffff";
  const appStoreImg = settings?.landingAppStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg";
  const playStoreImg = settings?.landingPlayStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";
  const playStoreUrl = settings?.playStoreLink || "#!";
  const appStoreUrl = settings?.appStoreLink || "#!";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Outer Banner Container */}
      <div className="relative bg-orange-50 rounded-[2.5rem] w-full overflow-hidden flex flex-col md:flex-row items-center justify-between px-8 md:px-16 pt-12 md:pt-0 md:h-[420px]">

        {/* Background Circles (Decorative) — slow independent rotation for depth */}
        <div className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute w-[600px] h-[600px] rounded-full border-[1.5px] border-orange-200/50 -right-[50px] -bottom-[150px]"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
            className="absolute w-[800px] h-[800px] rounded-full border-[1.5px] border-orange-200/50 -right-[150px] -bottom-[250px]"
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 100, repeat: Infinity, ease: 'linear' }}
            className="absolute w-[1000px] h-[1000px] rounded-full border-[1.5px] border-orange-200/50 -right-[250px] -bottom-[350px]"
          />
        </div>

        {/* Left Side Content */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 w-full md:w-[55%] flex flex-col items-center md:items-start text-center md:text-left mb-12 md:mb-0"
        >
          <span className={`mb-5 ${EYEBROW}`}>
            <Smartphone className="w-3.5 h-3.5" />
            Get the app
          </span>
          <h2 className={`${HEADING} mb-4 md:mb-5`}>
            Download the app now!
          </h2>
          <p className={`${BODY} mb-8 max-w-md`}>
            Experience seamless online ordering only on the ItzoFood app
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
              <img 
                src={playStoreImg}
                alt="Get it on Google Play" 
                className="h-[46px] object-contain cursor-pointer hover:scale-105 transition-transform" 
              />
            </a>
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
              <img 
                src={appStoreImg}
                alt="Download on the App Store" 
                className="h-[46px] object-contain cursor-pointer hover:scale-105 transition-transform" 
              />
            </a>
          </div>
        </motion.div>

        {/* Right Side Phone Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 w-full md:w-[45%] flex justify-center md:justify-end items-center h-full mt-8 md:mt-0 pb-12 md:pb-0"
        >
          {/* Phone Frame — a slow continuous float once it has landed */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            className="relative w-[280px] md:w-[320px] h-[360px] md:h-[380px] bg-white rounded-[2.5rem] border-[10px] border-slate-800 shadow-xl flex flex-col items-center pt-14"
          >
            {/* Phone Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[24px] bg-slate-800 rounded-b-[1.25rem] flex justify-center items-center">
               <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
            </div>

            {/* Phone Screen Content */}
            <div className="w-full flex flex-col items-center px-6">
              <p className="text-center text-slate-600 font-medium text-lg md:text-xl mb-5 leading-snug">
                Scan the QR code to<br/>download the app
              </p>

              {/* QR Code Container — subtle pulsing glow ring */}
              <div className="relative bg-white p-2 rounded-2xl border border-orange-100 shadow-sm">
                <motion.div
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -inset-1 rounded-2xl bg-[#FE5502]/20 -z-10 blur-md"
                />
                <img
                  src={qrCodeImg}
                  alt="QR Code"
                  className="w-36 h-36 object-contain rounded-xl"
                />
              </div>
            </div>

            {/* Phone Home Bar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-slate-200 rounded-full"></div>
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
});

export default CTASection;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const BenefitsSection = React.memo(function BenefitsSection() {
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

  if (!settings?.benefitsSectionEnabled || !settings?.benefitsImage?.url) {
    return null;
  }

  const imageUrl = settings.benefitsImage.url;
  const altText = settings.benefitsImageAlt || "ItzoFood Customer, Restaurant, and Delivery Partner Benefits";
  const redirectUrl = settings.benefitsImageLink;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] bg-gray-50 flex items-center justify-center">
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          className="w-full h-auto object-cover md:object-contain select-none transition-transform duration-500 hover:scale-[1.01]"
        />
      </div>
    </motion.div>
  );

  return (
    <section className="w-full bg-white py-12 md:py-20 overflow-hidden">
      {redirectUrl ? (
        <a 
          href={redirectUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl md:rounded-[2rem] overflow-hidden"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </section>
  );
});

export default BenefitsSection;

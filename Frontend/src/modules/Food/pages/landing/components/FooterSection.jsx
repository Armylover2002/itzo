import React, { useState, useEffect } from 'react';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const InstagramOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#paint0_linear)"/>
    <rect x="6" y="6" width="12" height="12" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="15.5" cy="8.5" r="0.9" fill="white" />
    <defs>
      <linearGradient id="paint0_linear" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FEE140"/>
        <stop offset="25%" stopColor="#FA709A"/>
        <stop offset="50%" stopColor="#D6017B"/>
        <stop offset="75%" stopColor="#8A3AB9"/>
        <stop offset="100%" stopColor="#4C5FD7"/>
      </linearGradient>
    </defs>
  </svg>
);

const YoutubeOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.54 6.42C22.4214 5.94523 22.1554 5.51865 21.7801 5.20455C21.4047 4.89045 20.9398 4.70568 20.45 4.68C18.6 4.5 12 4.5 12 4.5C12 4.5 5.4 4.5 3.55 4.68C3.06019 4.70568 2.59526 4.89045 2.21992 5.20455C1.84457 5.51865 1.5786 5.94523 1.46 6.42C1.22 8.24 1.22 12 1.22 12C1.22 12 1.22 15.76 1.46 17.58C1.5786 18.0548 1.84457 18.4814 2.21992 18.7955C2.59526 19.1095 3.06019 19.2943 3.55 19.32C5.4 19.5 12 19.5 12 19.5C12 19.5 18.6 19.5 20.45 19.32C20.9398 19.2943 21.4047 19.1095 21.7801 18.7955C22.1554 18.4814 22.4214 18.0548 22.54 17.58C22.78 15.76 22.78 12 22.78 12C22.78 12 22.78 8.24 22.54 6.42Z" fill="#FF0000"/>
    <path d="M9.75 15.02L15.5 12L9.75 8.98V15.02Z" fill="white"/>
  </svg>
);

const LinkedinOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452H16.891V14.881C16.891 13.554 16.868 11.848 15.044 11.848C13.201 11.848 12.918 13.287 12.918 14.786V20.452H9.362V9H12.776V10.561H12.825C13.3 9.66 14.463 8.712 16.182 8.712C19.774 8.712 20.447 11.074 20.447 14.167V20.452ZM5.337 7.433C4.195 7.433 3.275 6.51 3.275 5.37C3.275 4.232 4.195 3.309 5.337 3.309C6.474 3.309 7.4 4.232 7.4 5.37C7.4 6.51 6.474 7.433 5.337 7.433ZM7.119 20.452H3.555V9H7.119V20.452ZM22.225 0H1.771C0.792 0 0 0.774 0 1.729V22.271C0 23.227 0.792 24 1.771 24H22.222C23.2 24 24 23.227 24 22.271V1.729C24 0.774 23.2 0 22.225 0Z" fill="#0A66C2"/>
  </svg>
);

const FacebookOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0C5.373 0 0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24V15.563H7.078V12.073H10.125V9.412C10.125 6.388 11.916 4.716 14.658 4.716C15.97 4.716 17.344 4.951 17.344 4.951V7.92H15.831C14.34 7.92 13.875 8.85 13.875 9.805V12.073H17.188L16.656 15.563H13.875V24C19.612 23.094 24 18.1 24 12.073Z" fill="#1877F2"/>
  </svg>
);

const TwitterOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
  </svg>
);
const FooterSection = React.memo(function FooterSection() {
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

  const socialLinks = [
    { name: 'Linkedin', icon: LinkedinOriginal, url: settings?.socialLinkedinUrl || '#' },
    { name: 'Instagram', icon: InstagramOriginal, url: settings?.socialInstagramUrl || '#' },
    { name: 'Youtube', icon: YoutubeOriginal, url: settings?.socialYoutubeUrl || '#' },
    { name: 'Facebook', icon: FacebookOriginal, url: settings?.socialFacebookUrl || '#' },
    { name: 'X', icon: TwitterOriginal, url: settings?.socialTwitterUrl || '#' },
  ];

  let logoImg = settings?.landingFooterLogo?.url || "/itzo-logo-transparent.png";
  if (logoImg.includes("itzo-logo.jpg")) logoImg = "/itzo-logo-transparent.png";
  const appStoreImg = settings?.landingAppStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg";
  const playStoreImg = settings?.landingPlayStoreBadge?.url || "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";
  const playStoreUrl = settings?.playStoreLink || "#!";
  const appStoreUrl = settings?.appStoreLink || "#!";

  return (
    <footer className="bg-white pt-16 pb-8 border-t border-gray-200 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Logo Area */}
        <div className="mb-10">
          <img 
            src={logoImg} 
            alt="ItzoFood Logo" 
            className="h-12 md:h-16 w-auto object-contain rounded-xl" 
            onError={(e) => { e.target.src = "/itzo-logo-transparent.png"; }}
          />
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
          {/* Column 1 */}
          <div>
            <h3 className="font-medium text-black tracking-wide mb-4 text-[15px]">About ItzoFood</h3>
            <ul className="space-y-2.5 text-gray-600 text-[14px]">
              <li><a href="/about" className="hover:text-black transition-colors">Who We Are</a></li>
              <li><a href="/food/careers" className="hover:text-black transition-colors">Careers / Jobs</a></li>
              <li><a href="/contact" className="hover:text-black transition-colors">Contact Us</a></li>
              <li><a href="/hrms" className="hover:text-black transition-colors">HRMS Portal</a></li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h3 className="font-medium text-black tracking-wide mb-4 text-[15px]">For Restaurants</h3>
            <ul className="space-y-2.5 text-gray-600 text-[14px]">
              <li><a href="/food/restaurant" className="hover:text-black transition-colors">Partner With Us</a></li>
              <li><a href="/food/restaurant" className="hover:text-black transition-colors">Apps For You</a></li>
              <li><a href="/consulting" className="hover:text-black transition-colors">Restaurant Consulting</a></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h3 className="font-medium text-black tracking-wide mb-4 text-[15px]">For Delivery Partners</h3>
            <ul className="space-y-2.5 text-gray-600 text-[14px]">
              <li><a href="/food/delivery" className="hover:text-black transition-colors">Partner With Us</a></li>
              <li><a href="/food/delivery" className="hover:text-black transition-colors">Apps For You</a></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h3 className="font-medium text-black tracking-wide mb-4 text-[15px]">Learn More</h3>
            <ul className="space-y-2.5 text-gray-600 text-[14px]">
              <li><a href="/profile/privacy" className="hover:text-black transition-colors">Privacy</a></li>
              <li><a href="/profile/privacy" className="hover:text-black transition-colors">Security</a></li>
              <li><a href="/profile/terms" className="hover:text-black transition-colors">Terms & Conditions</a></li>
              <li><a href="/support" className="hover:text-black transition-colors">Help & Support</a></li>
            </ul>
          </div>

          {/* Column 5: Social & App */}
          <div>
            <h3 className="font-medium text-black tracking-wide mb-4 text-[15px]">Social Links</h3>
            <div className="flex gap-4 mb-6">
              {socialLinks.map((social) => (
                <a 
                  key={social.name} 
                  href={social.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform flex items-center justify-center w-8 h-8"
                  aria-label={social.name}
                >
                  <social.icon />
                </a>
              ))}
            </div>
            
            <div className="flex flex-col gap-3 w-[140px]">
              <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                <img src={appStoreImg} alt="App Store" loading="lazy" decoding="async" className="cursor-pointer hover:opacity-80 transition-opacity w-full border border-gray-200 rounded-md" />
              </a>
              <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                <img src={playStoreImg} alt="Google Play" loading="lazy" decoding="async" className="cursor-pointer hover:opacity-80 transition-opacity w-full border border-gray-200 rounded-md" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className="border-t border-gray-200 pt-6 mt-2">
          <p className="text-gray-500 text-[13px] leading-relaxed">
            By continuing past this page, you agree to our Terms & Conditions, Cookie Policy, Privacy Policy and Content Policies. All trademarks are properties of their respective owners 2026 © ItzoFood Partners Private Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
});

export default FooterSection;

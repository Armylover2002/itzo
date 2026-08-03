import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const Footer = () => {
    const { settings } = useSettings();
    const [dynamicLogoUrl, setDynamicLogoUrl] = useState(undefined);

    useEffect(() => {
        const loadLogo = async () => {
            try {
                const cached = getCachedSettings();
                if (cached?.logo?.url) {
                    setDynamicLogoUrl(cached.logo.url);
                } else {
                    const businessSettings = await loadBusinessSettings();
                    if (businessSettings?.logo?.url) {
                        setDynamicLogoUrl(businessSettings.logo.url);
                    }
                }
            } catch (error) {
                // Silently fail, fallback to useSettings
            }
        };
        loadLogo();

        const handleSettingsUpdate = () => {
            const cached = getCachedSettings();
            if (cached?.logo?.url) {
                setDynamicLogoUrl(cached.logo.url);
            }
        };
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
        };
    }, []);

    // Use the dynamic logo from businessSettings, fallback to settings context, then defaults
    let logoUrl = dynamicLogoUrl || settings?.logo?.url || settings?.landingFooterLogo?.url || settings?.userLogo?.url || settings?.adminLogo?.url || settings?.logoUrl || '/itzo-logo-transparent.png';
    
    // Edge case: override the old non-transparent logo if it's set in the DB
    if (typeof logoUrl === 'string' && logoUrl.includes('itzo-logo.jpg')) {
        logoUrl = '/itzo-logo-transparent.png';
    }

    // Force override for quick commerce footer logo to use the uploaded Itzo logo
    logoUrl = '/itzo-quick-logo.png';

    const primaryColor = settings?.primaryColor || '#FE5502';

    return (
        <footer className="relative bg-[#1a0800] pt-20 pb-10 mt-20 text-slate-100 md:bg-gradient-to-br md:from-[#FE5502] md:via-orange-600 md:to-[#C83C00] md:pt-32 md:pb-16 md:mt-32 overflow-hidden">
            {/* Subtle Texture/Glow Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px]" style={{ backgroundColor: primaryColor }} />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px]" style={{ backgroundColor: primaryColor }} />
            </div>

            {/* Top Curved Divider */}
            <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg className="relative block w-[calc(100%+1.3px)] h-[25px] md:h-[60px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white"></path>
                </svg>
            </div>

            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <img src={logoUrl} alt={`${settings?.appName || 'App'} Logo`} className="h-12 md:h-24 w-auto object-contain" />
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-white/90 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90"><Facebook size={18} /></a>}
                            {settings?.twitter && (
                                <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="X (formerly Twitter)">
                                    <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </a>
                            )}
                            {settings?.instagram && (
                                <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="Instagram">
                                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#paint0_linear_insta_qc)"/>
                                        <rect x="6" y="6" width="12" height="12" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
                                        <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.8" fill="none" />
                                        <circle cx="15.5" cy="8.5" r="0.9" fill="white" />
                                        <defs>
                                            <linearGradient id="paint0_linear_insta_qc" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                                                <stop offset="0%" stopColor="#FEE140"/>
                                                <stop offset="25%" stopColor="#FA709A"/>
                                                <stop offset="50%" stopColor="#D6017B"/>
                                                <stop offset="75%" stopColor="#8A3AB9"/>
                                                <stop offset="100%" stopColor="#4C5FD7"/>
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </a>
                            )}
                            {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90"><Youtube size={18} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            <li><Link to="/quick/home" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Home</Link></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>About Us</a></li>
                            <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Shop</Link></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Blogs</a></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Contact</a></li>
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Fruits & Vegetables</a></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Dairy Products</a></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Meat & Fish</a></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Bakery & Snacks</a></li>
                            <li><a href="#" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Beverages</a></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><MapPin size={22} /></div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white md:pt-1 font-medium">{settings?.address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Phone size={22} /></div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportPhone || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Mail size={22} /></div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportEmail || '—'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm md:flex md:justify-between md:text-left md:mt-24 md:pt-12">
                    <p className="md:text-base text-white/60">&copy; {new Date().getFullYear()} {settings?.appName || 'App'}. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <a href="#" className="hover:text-amber-200 md:text-base text-white/60 transition-all">Privacy Policy</a>
                        <a href="#" className="hover:text-amber-200 md:text-base text-white/60 transition-all">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


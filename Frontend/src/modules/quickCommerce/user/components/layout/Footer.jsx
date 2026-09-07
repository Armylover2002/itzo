import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { getCachedSettings, loadBusinessSettings, getAppLogo } from '@common/utils/businessSettings';
import { customerApi } from '../../services/customerApi';
import { getQuickCategoryPath } from '../../utils/routes';

const Footer = () => {
    const { settings } = useSettings();
    const [dynamicLogoUrl, setDynamicLogoUrl] = useState(undefined);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const loadLogo = async () => {
            try {
                const cached = getCachedSettings();
                const foundLogo = cached?.userLogo?.url || cached?.logo?.url || cached?.landingFooterLogo?.url || cached?.landingNavbarLogo?.url || cached?.adminLogo?.url || getAppLogo('user');
                if (foundLogo && !foundLogo.includes('itzo-logo.jpg')) {
                    setDynamicLogoUrl(foundLogo);
                } else {
                    const businessSettings = await loadBusinessSettings();
                    const loadedLogo = businessSettings?.userLogo?.url || businessSettings?.logo?.url || businessSettings?.landingFooterLogo?.url || businessSettings?.landingNavbarLogo?.url || businessSettings?.adminLogo?.url;
                    if (loadedLogo) {
                        setDynamicLogoUrl(loadedLogo);
                    }
                }
            } catch (error) {
                // Silently fail, fallback to useSettings
            }
        };
        loadLogo();

        const handleSettingsUpdate = (e) => {
            const cached = e?.detail || getCachedSettings();
            const foundLogo = cached?.userLogo?.url || cached?.logo?.url || cached?.landingFooterLogo?.url || cached?.landingNavbarLogo?.url || cached?.adminLogo?.url;
            if (foundLogo) {
                setDynamicLogoUrl(foundLogo);
            }
        };
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
        };
    }, []);

    // Load dynamic categories from catalog API
    useEffect(() => {
        let isMounted = true;
        customerApi.getCategories()
            .then((res) => {
                if (!isMounted) return;
                const list = res?.data?.results || res?.data?.result || [];
                if (Array.isArray(list) && list.length > 0) {
                    const headers = list.filter((c) => c.type === 'header' || !c.parentId);
                    const displayList = headers.length > 0 ? headers : list;
                    setCategories(displayList.slice(0, 6));
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    const cached = getCachedSettings();

    // Use the dynamic logo from businessSettings, fallback to settings context, then defaults
    let logoUrl = dynamicLogoUrl || 
        settings?.userLogo?.url || 
        settings?.logoUrl || 
        settings?.logo?.url || 
        settings?.landingFooterLogo?.url || 
        settings?.adminLogo?.url || 
        getAppLogo('user') || 
        '/itzo-logo-transparent.png';
    
    // Edge case: override the old non-transparent logo if it's set in the DB
    if (typeof logoUrl === 'string' && logoUrl.includes('itzo-logo.jpg')) {
        logoUrl = '/itzo-logo-transparent.png';
    }

    const primaryColor = settings?.primaryColor || '#FE5502';
    const appName = settings?.companyName || settings?.appName || cached?.companyName || 'ItzoFood';

    const address = settings?.address || [cached?.address, cached?.state, cached?.pincode].filter(Boolean).join(', ') || cached?.address || '';
    const phone = settings?.supportPhone || cached?.companySupportNumber || (cached?.phone?.number ? `${cached?.phone?.countryCode || '+91'} ${cached?.phone?.number}` : '') || '';
    const email = settings?.supportEmail || cached?.customerSupportEmail || cached?.helpAndSupportEmail || cached?.email || '';

    const facebookUrl = settings?.facebook || cached?.socialFacebookUrl;
    const twitterUrl = settings?.twitter || cached?.socialTwitterUrl;
    const instagramUrl = settings?.instagram || cached?.socialInstagramUrl;
    const youtubeUrl = settings?.youtube || cached?.socialYoutubeUrl;

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <img
                                src={logoUrl}
                                alt={`${appName} Logo`}
                                className="h-12 md:h-24 w-auto object-contain max-w-[200px]"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/itzo-logo-transparent.png';
                                }}
                            />
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-white/90 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {facebookUrl && (
                                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90">
                                    <Facebook size={18} />
                                </a>
                            )}
                            {twitterUrl && (
                                <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="X (formerly Twitter)">
                                    <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </a>
                            )}
                            {instagramUrl && (
                                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="Instagram">
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
                            {youtubeUrl && (
                                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90">
                                    <Youtube size={18} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Dynamic Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {categories.length > 0 ? (
                                categories.map((cat) => (
                                    <li key={cat._id || cat.id}>
                                        <Link
                                            to={getQuickCategoryPath(cat._id || cat.id || cat.slug)}
                                            className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"
                                        >
                                            <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>
                                            {cat.name}
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                <>
                                    <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Electronics</Link></li>
                                    <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Fashion</Link></li>
                                    <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Grocery</Link></li>
                                    <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Stationery</Link></li>
                                    <li><Link to="/quick/categories" className="hover:text-amber-200 transition-colors md:text-base md:font-semibold flex items-center group text-white"><span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>Toys & Games</Link></li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Dynamic Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><MapPin size={22} /></div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white md:pt-1 font-medium leading-relaxed">{address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Phone size={22} /></div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                {phone ? (
                                    <a href={`tel:${phone.replace(/\s+/g, '')}`} className="md:text-base text-white font-medium hover:text-amber-200 transition-colors">
                                        {phone}
                                    </a>
                                ) : (
                                    <span className="md:text-base text-white font-medium">—</span>
                                )}
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Mail size={22} /></div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                {email ? (
                                    <a href={`mailto:${email}`} className="md:text-base text-white font-medium hover:text-amber-200 transition-colors break-all">
                                        {email}
                                    </a>
                                ) : (
                                    <span className="md:text-base text-white font-medium">—</span>
                                )}
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm md:flex md:justify-between md:text-left md:mt-24 md:pt-12">
                    <p className="md:text-base text-white/60">&copy; {new Date().getFullYear()} {appName}. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <Link to="/quick/privacy" className="hover:text-amber-200 md:text-base text-white/60 transition-all">Privacy Policy</Link>
                        <Link to="/quick/terms" className="hover:text-amber-200 md:text-base text-white/60 transition-all">Terms & Conditions</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


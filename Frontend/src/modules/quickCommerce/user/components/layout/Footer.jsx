import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/assets/Logo.jpeg';
import { useSettings } from '@core/context/SettingsContext';
import { shiftHex } from '../../utils/headerTheme';
import { customerApi } from '../../services/customerApi';
import { getWithDedupe } from '@core/api/dedupe';
import { getQuickCategoryPath, getQuickHomePath } from '../../utils/routes';

// Static link lists — defined outside so they're never recreated
const QUICK_LINKS = [
    { label: 'Home', path: '/' },
    { label: 'About Us', path: '/food/user/profile/about' },
    { label: 'Shop', path: '/quick' },
    { label: 'Safety & Emergency', path: '/food/user/profile/report-safety-emergency' },
    { label: 'Contact', path: '/food/user/profile/support' }
];

const FOOD_CATEGORIES = [
    { name: 'Multi-cuisine', slug: 'multi-cuisine' },
    { name: 'Bakery', slug: 'bakery' },
    { name: 'Desserts', slug: 'desserts' },
    { name: 'Fast Food', slug: 'fast-food' },
    { name: 'Beverages', slug: 'beverages' }
];

const SOCIAL_ICONS = [
    { key: 'facebook', Icon: Facebook },
    { key: 'twitter', Icon: Twitter },
    { key: 'instagram', Icon: Instagram },
    { key: 'youtube', Icon: Youtube },
];

const Footer = ({ themeColor: themeColorProp }) => {
    const { settings } = useSettings();
    const location = useLocation();
    
    const isQuick = location.pathname.startsWith("/quick");
    const isFood = !isQuick;

    const logoUrl = settings?.logoUrl || Logo;
    const defaultPrimaryColor = settings?.primaryColor || '#ea580c';

    const [themeColor, setThemeColor] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.sessionStorage.getItem('food.quick.headerColor') || defaultPrimaryColor;
        }
        return defaultPrimaryColor;
    });

    const [dynamicCategories, setDynamicCategories] = useState([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                if (isQuick) {
                    const res = await customerApi.getCategories({ tree: true });
                    const results = res?.data?.results || res?.data?.result || [];
                    const allCategories = Array.isArray(results) ? results : [];
                    // Footer shows header tabs only — link by Mongo id (route uses /quick/categories/:id)
                    const headers = allCategories
                        .filter((cat) => !cat?.type || cat.type === 'header')
                        .map((cat) => ({
                            id: cat._id || cat.id,
                            _id: cat._id || cat.id,
                            name: cat.name,
                            slug: cat.slug || String(cat.name || '').toLowerCase().replace(/\s+/g, '-'),
                        }))
                        .filter((cat) => cat.id && cat.name);
                    if (headers.length > 0) {
                        setDynamicCategories(headers.slice(0, 5));
                    }
                } else if (isFood) {
                    // Deduped/cached (60s TTL): UserLayout (and this Footer) remounts on
                    // every /food/user <-> /quick tab switch, which was
                    // re-firing this request on each switch with no caching at all.
                    const res = await getWithDedupe('/food/admin/categories/public', {}, { ttl: 60 * 1000 });
                    const cats = res?.data?.data?.categories || [];
                    const allCategories = Array.isArray(cats) ? cats : [];
                    if (allCategories.length > 0) {
                        setDynamicCategories(allCategories.map(cat => ({
                            id: cat.slug || cat._id,
                            name: cat.name,
                            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')
                        })).slice(0, 5));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch categories for footer", error);
            }
        };
        fetchCategories();
    }, [isQuick, isFood]);

    useEffect(() => {
        const handleThemeChange = () => {
            const color = window.sessionStorage.getItem('food.quick.headerColor');
            if (color) setThemeColor(color);
        };
        window.addEventListener('quickThemeChange', handleThemeChange);
        return () => window.removeEventListener('quickThemeChange', handleThemeChange);
    }, []);

    const primaryColor = themeColorProp || themeColor;
    const appName = settings?.appName || 'DukaanWallah';
    const currentYear = useMemo(() => new Date().getFullYear(), []); // year never changes in session

    // Only recompute social links when settings changes
    const socialLinks = useMemo(
        () =>
            SOCIAL_ICONS.filter(({ key }) => !!settings?.[key]).map(({ key, Icon }) => ({
                key,
                href: settings[key],
                Icon,
            })),
        [settings],
    );

    const categoriesToDisplay = useMemo(() => {
        if (isFood && dynamicCategories.length > 0) return dynamicCategories;
        if (isFood) return FOOD_CATEGORIES;
        return dynamicCategories;
    }, [isFood, dynamicCategories]);

    const getCategoryLink = (cat) => {
        if (isQuick) {
            const id = cat?.id || cat?._id;
            return id ? getQuickCategoryPath(id) : getQuickHomePath();
        }
        return `/food/user/category/${cat.slug}`;
    };

    return (
        <footer
            className="dynamic-footer-bg relative bg-[#1a0f05] pt-12 pb-8 mt-10 text-slate-300 md:pt-16 md:pb-10 md:mt-12 overflow-hidden transition-colors duration-500"
            style={{
                '--footer-gradient': `linear-gradient(to bottom right, ${shiftHex(primaryColor, -20) || '#ea580c'}, ${primaryColor || '#ea580c'}, ${shiftHex(primaryColor, -40) || '#ea580c'})`
            }}
        >
            <style>{`
                @media (min-width: 768px) {
                    .dynamic-footer-bg {
                        background-image: var(--footer-gradient) !important;
                    }
                }
            `}</style>
            {/* Subtle Texture/Glow Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div
                    className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px]"
                    style={{ backgroundColor: primaryColor }}
                />
                <div
                    className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px]"
                    style={{ backgroundColor: primaryColor }}
                />
            </div>

            {/* Top Curved Divider */}
            <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg
                    className="relative block w-[calc(100%+1.3px)] h-[25px] md:h-[60px]"
                    data-name="Layer 1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white" />
                </svg>
            </div>

            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-3 md:space-y-6">
                        <div className="flex items-center">
                            <img
                                src={logoUrl}
                                alt={`${appName} Logo`}
                                className="h-10 md:h-14 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity rounded-sm"
                                loading="lazy"
                            />
                        </div>
                        <p className="text-sm leading-relaxed md:text-[15px] md:leading-relaxed text-white/90 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map(({ key, href, Icon }) => (
                                <a
                                    key={key}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90"
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-2">
                        <h3 className="text-white font-bold text-lg mb-3 md:text-[17px] md:font-extrabold md:uppercase md:tracking-wide md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-3">
                            {QUICK_LINKS.map(({ label, path }) => (
                                <li key={label}>
                                    <Link
                                        to={path}
                                        className="text-slate-200 hover:text-white transition-colors md:text-[15px] md:font-medium flex items-center group"
                                    >
                                        <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all" />
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-2">
                        <h3 className="text-white font-bold text-lg mb-3 md:text-[17px] md:font-extrabold md:uppercase md:tracking-wide md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-3">
                            {categoriesToDisplay.length > 0 ? (
                                categoriesToDisplay.map((cat) => (
                                    <li key={cat.id || cat._id || cat.slug}>
                                        <Link
                                            to={getCategoryLink(cat)}
                                            className="text-slate-200 hover:text-white transition-colors md:text-[15px] md:font-medium flex items-center group"
                                        >
                                            <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all" />
                                            {cat.name}
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                <li className="text-slate-400 italic text-sm">Loading categories...</li>
                            )}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-2">
                        <h3 className="text-white font-bold text-lg mb-3 md:text-[17px] md:font-extrabold md:uppercase md:tracking-wide md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }} />
                            Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-5">
                            <li className="flex items-start gap-3 md:gap-4 group">
                                <div className="hidden md:flex h-10 w-10 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <MapPin size={20} />
                                </div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-[15px] text-slate-200 md:pt-1 font-medium">{settings?.address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-4 group">
                                <div className="hidden md:flex h-10 w-10 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <Phone size={20} />
                                </div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-[15px] text-slate-200 font-medium">{settings?.supportPhone || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-4 group">
                                <div className="hidden md:flex h-10 w-10 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90">
                                    <Mail size={20} />
                                </div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-[15px] text-slate-200 font-medium">{settings?.supportEmail || '—'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-10 pt-6 text-center text-sm md:flex md:justify-between md:text-left md:mt-16 md:pt-8">
                    <p className="md:text-[15px] text-white/70">
                        &copy; {currentYear} Blaze. All rights reserved.
                    </p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-8">
                        <Link to="/food/user/profile/privacy" className="hover:text-white md:text-[15px] text-white/70 transition-all font-medium">Privacy Policy</Link>
                        <Link to="/food/user/profile/terms" className="hover:text-white md:text-[15px] text-white/70 transition-all font-medium">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default React.memo(Footer);
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const NAV_LINKS = [
  { to: '/food/careers', label: 'Jobs' },
  { to: '/food/restaurant', label: 'Add restaurant' },
];

const Navbar = React.memo(function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    let timeoutId = null;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        setIsScrolled(window.scrollY > 40);
        timeoutId = null;
      }, 50); // throttle 50ms
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Close the mobile menu automatically once the user scrolls the page.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = () => setMobileMenuOpen(false);
    window.addEventListener('scroll', close, { passive: true });
    return () => window.removeEventListener('scroll', close);
  }, [mobileMenuOpen]);

  let logoImg = settings?.landingNavbarLogo?.url || "/itzo-logo-transparent.png";
  if (logoImg.includes("itzo-logo.jpg")) logoImg = "/itzo-logo-transparent.png";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4">
      {/* Floating pill navbar — deliberately not a full-width bar, so it reads as a
          distinct piece of UI rather than the usual edge-to-edge nav. */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`relative max-w-6xl mx-auto rounded-[28px] transition-all duration-300 ${
          isScrolled
            ? 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] text-gray-800'
            : 'bg-white/10 backdrop-blur-xl border border-white/15 text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]'
        }`}
      >
        <div className="flex justify-between items-center h-16 md:h-[70px] px-4 sm:px-5 md:px-7">

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer group shrink-0"
            onClick={() => window.location.href = '/food/user'}
          >
            <img
              src={logoImg}
              alt="ItzoFood Logo"
              className="h-9 md:h-11 w-auto object-contain rounded-md transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { e.target.src = "/itzo-logo-transparent.png"; }}
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="relative text-[15px] font-semibold px-4 py-2 rounded-full transition-colors hover:bg-white/15 data-[scrolled=true]:hover:bg-black/5"
              >
                {link.label}
              </Link>
            ))}
            <div className="w-px h-6 bg-current opacity-15 mx-2" />
            <button
              onClick={() => navigate('/user/auth/login')}
              className="text-[15px] font-semibold px-4 py-2 rounded-full transition-colors hover:bg-white/15"
            >
              Log in
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/user/auth/signup')}
              className={`ml-1 text-[15px] font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors ${
                isScrolled
                  ? 'bg-[#FE5502] text-white hover:bg-[#e04a00]'
                  : 'bg-white text-slate-900 hover:bg-white/90'
              }`}
            >
              Sign up
            </motion.button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={`p-2 rounded-full focus:outline-none ${isScrolled ? '' : 'bg-white/10'}`}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileMenuOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu — its own floating card, matching the pill nav language */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden max-w-6xl mx-auto mt-2 bg-white text-gray-800 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden"
          >
            <div className="py-3 px-5 flex flex-col">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Link
                    to={link.to}
                    className="block text-base font-semibold py-3 border-b border-gray-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.button
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => { setMobileMenuOpen(false); navigate('/user/auth/login'); }}
                className="text-left text-base font-semibold py-3 border-b border-gray-100"
              >
                Log in
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => { setMobileMenuOpen(false); navigate('/user/auth/signup'); }}
                className="text-left text-base font-bold py-3 text-[#FE5502]"
              >
                Sign up
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Navbar;

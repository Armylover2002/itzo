import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, Menu, X, ChevronDown } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

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
        setIsScrolled(window.scrollY > 50);
        timeoutId = null;
      }, 50); // throttle 50ms
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const navClass = isScrolled 
    ? 'bg-white shadow-md text-gray-800' 
    : 'bg-transparent text-white';

  let logoImg = settings?.landingNavbarLogo?.url || "/itzo-logo-transparent.png";
  if (logoImg.includes("itzo-logo.jpg")) logoImg = "/itzo-logo-transparent.png";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${navClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/food/user'}>
            <img 
              src={logoImg} 
              alt="ItzoFood Logo" 
              className="h-10 md:h-12 w-auto object-contain rounded-md" 
              onError={(e) => { e.target.src = "/itzo-logo-transparent.png"; }}
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/food/careers" className="text-lg font-medium hover:text-rose-400 transition-colors">Jobs</Link>
            <Link to="/food/restaurant" className="text-lg font-medium hover:text-rose-400 transition-colors">Add restaurant</Link>
            <div className="flex items-center space-x-6">
              <button onClick={() => navigate('/user/auth/login')} className="text-lg font-medium hover:text-rose-400 transition-colors">Log in</button>
              <button onClick={() => navigate('/user/auth/signup')} className="text-lg font-medium hover:text-rose-400 transition-colors">Sign up</button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-md focus:outline-none">
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white text-gray-800 shadow-xl absolute top-20 left-0 right-0 py-4 px-6 flex flex-col space-y-4 border-t border-gray-100">
          <Link to="/food/careers" className="text-lg font-medium py-2 border-b border-gray-100">Jobs</Link>
          <Link to="/food/restaurant" className="text-lg font-medium py-2 border-b border-gray-100">Add restaurant</Link>
          <button onClick={() => navigate('/user/auth/login')} className="text-left text-lg font-medium py-2 border-b border-gray-100">Log in</button>
          <button onClick={() => navigate('/user/auth/signup')} className="text-left text-lg font-medium py-2">Sign up</button>
        </div>
      )}
    </nav>
  );
});

export default Navbar;

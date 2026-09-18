import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Menu, X, CheckCircle2, Navigation, UserPlus } from 'lucide-react';
import SlideButton from './SlideButton';

const FloatingSidebar = React.memo(function FloatingSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    
    let timeoutId = null;
    const handleResize = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        checkMobile();
        timeoutId = null;
      }, 100);
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleWhatsApp = () => {
    window.open('https://wa.me/1234567890', '_blank');
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && !isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-orange-500 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-orange-600 transition-colors"
        >
          <Menu size={24} />
        </motion.button>
      )}

      {/* Backdrop for Mobile */}
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Panel */}
      <AnimatePresence>
        {(!isMobile || isOpen) && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed z-50 bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
              isMobile 
                ? 'bottom-0 right-0 left-0 rounded-t-3xl p-6 pb-10' 
                : 'top-1/4 right-6 w-80 rounded-3xl p-6'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic text-gray-800 tracking-tight">Partner Portal</h3>
              {isMobile && (
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Normal Buttons */}
              <button className="w-full h-12 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 text-gray-700 hover:text-orange-600 rounded-xl flex items-center px-4 transition-all duration-300 shadow-sm group">
                <UserPlus size={18} className="mr-3 text-gray-400 group-hover:text-orange-500" />
                <span className="font-semibold text-sm">Onboarding Setup</span>
              </button>

              <button className="w-full h-12 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 text-gray-700 hover:text-orange-600 rounded-xl flex items-center px-4 transition-all duration-300 shadow-sm group">
                <CheckCircle2 size={18} className="mr-3 text-gray-400 group-hover:text-orange-500" />
                <span className="font-semibold text-sm">Accept Order</span>
              </button>

              {/* Slider Actions */}
              <SlideButton 
                text="Slide to Accept" 
                successText="Accepted!" 
                color="bg-orange-500" 
              />
              
              <SlideButton 
                text="Slide to Reach" 
                successText="Arrived!" 
                color="bg-emerald-500"
                icon={Navigation}
              />

              {/* Divider */}
              <div className="w-full h-px bg-gray-200 my-2" />

              {/* WhatsApp CTA */}
              <button 
                onClick={handleWhatsApp}
                className="w-full h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl flex items-center justify-center transition-colors duration-300 shadow-md shadow-green-500/20 gap-2 font-semibold"
              >
                <MessageCircle size={20} />
                WhatsApp Chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default FloatingSidebar;

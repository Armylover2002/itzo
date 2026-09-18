import React from 'react';
import { Store, MapPin, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';

const BetterFoodSection = React.memo(function BetterFoodSection() {
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

  const pizzaImg = settings?.landingPizzaImage?.url || "https://freepngimg.com/thumb/pizza/35-pizza-png-image.png";
  const tomatoImg = settings?.landingTomatoImage?.url || "https://freepngimg.com/thumb/tomato/22-tomato-png-image.png";

  return (
    <div className="relative w-full bg-white py-20 md:py-28 overflow-hidden">
      
      {/* Decorative Circles in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top left large circle */}
        <div className="absolute -top-[400px] -left-[200px] w-[800px] h-[800px] rounded-full border-[1.5px] border-orange-200/50" />
        {/* Top left small circle */}
        <div className="absolute -top-[200px] -left-[100px] w-[400px] h-[400px] rounded-full border-[1.5px] border-orange-200/50" />
        {/* Right side large circle */}
        <div className="absolute -top-[100px] -right-[300px] w-[900px] h-[900px] rounded-full border-[1.5px] border-orange-200/50" />
        {/* Right side small circle */}
        <div className="absolute top-[100px] -right-[150px] w-[400px] h-[400px] rounded-full border-[1.5px] border-orange-200/50" />
      </div>

      {/* Floating Images (using generic transparent food images) */}
      <motion.img 
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        viewport={{ once: true }}
        src={pizzaImg}
        alt="Pizza"
        className="absolute right-[-2%] md:right-[5%] top-[45%] md:top-[40%] w-48 md:w-[350px] object-contain drop-shadow-2xl rotate-12 hidden sm:block"
      />
      
      {/* Small Tomatoes */}
      <img src={tomatoImg} alt="Tomato" className="absolute top-[15%] right-[25%] w-10 md:w-12 opacity-90 rotate-45 hidden md:block drop-shadow-lg" />
      <img src={tomatoImg} alt="Tomato" className="absolute bottom-[25%] left-[20%] w-8 md:w-10 opacity-90 -rotate-45 hidden md:block drop-shadow-lg" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        
        {/* Heading */}
        <motion.h2 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-[40px] md:text-[64px] font-bold text-primary text-center leading-tight mb-6 md:mb-8"
        >
          Food you'll love,<br/>delivered fast
        </motion.h2>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-[22px] text-slate-500 text-center max-w-[650px] mb-16 md:mb-24 leading-relaxed font-medium px-4"
        >
          We help you discover new tastes from restaurants you'll love, delivered right to your doorstep
        </motion.p>

        {/* Stats Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-[950px] bg-white rounded-3xl md:rounded-[3rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 relative z-20"
        >
          {/* Highlight 1 */}
          <div className="flex items-center gap-5 w-full md:w-1/3 justify-center md:justify-start">
            <Store className="w-11 h-11 text-primary flex-shrink-0" strokeWidth={1.5} />
            <div className="flex flex-col items-start">
              <span className="text-lg md:text-xl font-bold text-slate-800 leading-tight">Curated restaurants</span>
              <span className="text-slate-500 font-medium mt-0.5 text-sm">Handpicked & quality-checked</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-16 bg-gray-200" />

          {/* Highlight 2 */}
          <div className="flex items-center gap-5 w-full md:w-1/3 justify-center">
            <MapPin className="w-11 h-11 text-primary flex-shrink-0" strokeWidth={1.5} />
            <div className="flex flex-col items-start">
              <span className="text-lg md:text-xl font-bold text-slate-800 leading-tight">Live order tracking</span>
              <span className="text-slate-500 font-medium mt-0.5 text-sm">Know exactly where it is</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-16 bg-gray-200" />

          {/* Highlight 3 */}
          <div className="flex items-center gap-5 w-full md:w-1/3 justify-center md:justify-end">
            <ShoppingBag className="w-11 h-11 text-primary flex-shrink-0" strokeWidth={1.5} />
            <div className="flex flex-col items-start">
              <span className="text-lg md:text-xl font-bold text-slate-800 leading-tight">Fast, fresh delivery</span>
              <span className="text-slate-500 font-medium mt-0.5 text-sm">Straight from the kitchen</span>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
});

export default BetterFoodSection;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, MapPin, ShoppingBag, ArrowRight, Star, Bike } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCachedSettings, loadBusinessSettings } from '@common/utils/businessSettings';
import { EYEBROW, HEADING, BODY } from './typography';

const TAGS = [
  { icon: Store, label: 'Curated restaurants' },
  { icon: MapPin, label: 'Live order tracking' },
  { icon: ShoppingBag, label: 'Fast, fresh delivery' },
];

const BetterFoodSection = React.memo(function BetterFoodSection() {
  const [settings, setSettings] = React.useState(null);
  const navigate = useNavigate();

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
    <div className="relative w-full bg-gradient-to-b from-orange-50/60 via-white to-white py-20 md:py-28 overflow-hidden">

      {/* Decorative Circles in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[400px] -left-[200px] w-[800px] h-[800px] rounded-full border-[1.5px] border-orange-200/50" />
        <div className="absolute -top-[200px] -left-[100px] w-[400px] h-[400px] rounded-full border-[1.5px] border-orange-200/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">

        {/* LEFT — copy + tag pills + CTA */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`mb-5 ${EYEBROW}`}
          >
            Why itzofood
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`${HEADING} mb-6`}
          >
            Food you&apos;ll love,<br/>delivered <span className="text-[#FE5502]">fast</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className={`${BODY} max-w-lg mb-8`}
          >
            We help you discover new tastes from restaurants you&apos;ll love, delivered right to your doorstep.
          </motion.p>

          {/* Tag pills instead of the old horizontal white bar */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-9">
            {TAGS.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.08 }}
                whileHover={{ y: -3 }}
                className="flex items-center gap-2 rounded-full bg-white border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.05)] pl-2.5 pr-4 py-2"
              >
                <div className="w-7 h-7 rounded-full bg-[#FE5502]/10 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-[#FE5502]" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold text-slate-700">{label}</span>
              </motion.div>
            ))}
          </div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.55 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/food/user')}
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-slate-900 text-white text-base font-bold shadow-lg"
          >
            Explore restaurants
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </div>

        {/* RIGHT — big tilted visual card with overlapping stat chips */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotate: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none aspect-square lg:aspect-[4/3.4]"
        >
          <motion.div
            animate={{ rotate: [3, 1.5, 3] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-4 md:inset-8 rounded-[3rem] bg-gradient-to-br from-[#ffe4cc] via-[#ffd0a8] to-[#ffb37a] shadow-[0_25px_60px_rgba(255,120,0,0.25)] overflow-hidden flex items-center justify-center"
          >
            <motion.img
              animate={{ y: [0, -16, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              src={pizzaImg}
              alt="Pizza"
              className="w-[70%] object-contain drop-shadow-2xl"
            />
            <motion.img
              animate={{ y: [0, -8, 0], rotate: [45, 55, 45] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              src={tomatoImg}
              alt="Tomato"
              className="absolute top-[12%] left-[10%] w-10 md:w-12 opacity-90 drop-shadow-lg"
            />
            <motion.img
              animate={{ y: [0, 10, 0], rotate: [-45, -35, -45] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              src={tomatoImg}
              alt="Tomato"
              className="absolute bottom-[16%] right-[12%] w-8 md:w-10 opacity-90 drop-shadow-lg"
            />
          </motion.div>

          {/* Overlapping glass stat chips — decorative, no numeric claims */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="absolute top-2 left-0 md:-left-4 flex items-center gap-2.5 rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] pl-2.5 pr-4 py-2.5"
          >
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <span className="text-sm font-bold text-slate-800">Top rated near you</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.75 }}
            className="absolute bottom-2 right-0 md:-right-4 flex items-center gap-2.5 rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] pl-2.5 pr-4 py-2.5"
          >
            <div className="w-9 h-9 rounded-full bg-[#FE5502]/10 flex items-center justify-center">
              <Bike className="w-4 h-4 text-[#FE5502]" />
            </div>
            <span className="text-sm font-bold text-slate-800">Doorstep in minutes</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});

export default BetterFoodSection;

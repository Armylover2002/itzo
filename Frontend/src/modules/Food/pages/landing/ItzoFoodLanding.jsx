import React, { useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import MarqueeStrip from './components/MarqueeStrip';

const BetterFoodSection = lazy(() => import('./components/BetterFoodSection'));
const AppFeaturesSection = lazy(() => import('./components/AppFeaturesSection'));
const PromiseSection = lazy(() => import('./components/PromiseSection'));
const GoldSection = lazy(() => import('./components/GoldSection'));
const BenefitsSection = lazy(() => import('./components/BenefitsSection'));
const FeaturedOpeningsSection = lazy(() => import('./components/FeaturedOpeningsSection'));
const CTASection = lazy(() => import('./components/CTASection'));
const FooterSection = lazy(() => import('./components/FooterSection'));

export default function ItzoFoodLanding() {
  const navigate = useNavigate();
  // Whole-page scroll progress — a single continuous motion cue that ties the
  // entire redesign together, from the top nav all the way to the footer.
  const { scrollYProgress } = useScroll();
  const progressBar = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#FE5502] selection:text-white">
      <motion.div
        style={{ scaleX: progressBar }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-[#FE5502] origin-left z-[60]"
      />
      <Navbar />
      <HeroSection navigate={navigate} />
      <MarqueeStrip />
      <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#FE5502] border-t-transparent rounded-full animate-spin"></div></div>}>
        <BetterFoodSection />
        <AppFeaturesSection />
        <PromiseSection />
        <GoldSection />
        <BenefitsSection />
        <FeaturedOpeningsSection />
        <CTASection />
        <FooterSection />
      </Suspense>
    </div>
  );
}

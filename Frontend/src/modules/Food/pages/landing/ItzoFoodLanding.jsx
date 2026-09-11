import React, { useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';

const BetterFoodSection = lazy(() => import('./components/BetterFoodSection'));
const AppFeaturesSection = lazy(() => import('./components/AppFeaturesSection'));
const GoldSection = lazy(() => import('./components/GoldSection'));
const BenefitsSection = lazy(() => import('./components/BenefitsSection'));
const FeaturedOpeningsSection = lazy(() => import('./components/FeaturedOpeningsSection'));
const CTASection = lazy(() => import('./components/CTASection'));
const FooterSection = lazy(() => import('./components/FooterSection'));

export default function ItzoFoodLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary selection:text-white">
      <Navbar />
      <HeroSection navigate={navigate} />
      <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
        <BetterFoodSection />
        <AppFeaturesSection />
        <GoldSection />
        <BenefitsSection />
        <FeaturedOpeningsSection />
        <CTASection />
        <FooterSection />
      </Suspense>
    </div>
  );
}

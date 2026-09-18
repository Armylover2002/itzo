import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import { motion } from 'framer-motion';

export default function AboutUs() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Navbar />
      <main className="flex-grow pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">Who We Are</h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            We are dedicated to bringing the best food from the best restaurants directly to your doorstep. 
            Our mission is to elevate the dining experience through technology, convenience, and unparalleled service.
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Vision</h3>
            <p className="text-slate-600">To be the most trusted and loved food delivery platform in every city we operate.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Values</h3>
            <p className="text-slate-600">Customer first, continuous innovation, integrity, and fostering local community growth.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Team</h3>
            <p className="text-slate-600">A passionate group of foodies, engineers, and operators working tirelessly for you.</p>
          </div>
        </div>
      </main>
      <FooterSection />
    </div>
  );
}

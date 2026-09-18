import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import { motion } from 'framer-motion';
import { loadBusinessSettings } from '@common/utils/businessSettings';

export default function ContactUs() {
  const [supportEmail, setSupportEmail] = useState('support@itzofood.com');
  const [partnershipEmail, setPartnershipEmail] = useState('partners@itzofood.com');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadBusinessSettings().then(settings => {
      if (settings?.customerSupportEmail) setSupportEmail(settings.customerSupportEmail);
      if (settings?.partnershipEmail) setPartnershipEmail(settings.partnershipEmail);
    });
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">Contact Us</h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            We'd love to hear from you. Whether you have a question about our services, pricing, or anything else, our team is ready to answer all your questions.
          </p>
        </motion.div>
        
        <div className="flex flex-col items-center space-y-10 max-w-2xl mx-auto text-center bg-slate-50 border border-slate-100 rounded-3xl p-12">
          <div>
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto mb-4">💬</div>
            <h4 className="text-2xl font-bold text-slate-900 mb-3">Customer Support</h4>
            <p className="text-slate-600 text-lg mb-2">Need help with an order? Contact our 24/7 support team.</p>
            <p className="text-rose-500 font-bold text-lg">{supportEmail}</p>
          </div>
          <div className="w-full h-px bg-slate-200"></div>
          <div>
            <div className="w-12 h-12 bg-orange-100 text-primary rounded-full flex items-center justify-center text-xl mx-auto mb-4">🤝</div>
            <h4 className="text-2xl font-bold text-slate-900 mb-3">Partnerships</h4>
            <p className="text-slate-600 text-lg mb-2">Interested in partnering with us? Let's talk.</p>
            <p className="text-rose-500 font-bold text-lg">{partnershipEmail}</p>
          </div>
        </div>
      </main>
      <FooterSection />
    </div>
  );
}

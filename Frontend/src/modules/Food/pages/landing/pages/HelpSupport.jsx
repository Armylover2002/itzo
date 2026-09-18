import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import { motion } from 'framer-motion';
import { loadBusinessSettings } from '@common/utils/businessSettings';

export default function HelpSupport() {
  const [supportEmail, setSupportEmail] = useState('support@itzofood.com');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadBusinessSettings().then(settings => {
      if (settings?.helpAndSupportEmail) setSupportEmail(settings.helpAndSupportEmail);
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">Help & Support</h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            How can we help you today? Browse our frequently asked questions or contact our support team.
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto mb-16">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">How do I track my order?</h4>
                <p className="text-slate-600">Once your order is placed, you can track its status in real-time through the 'Orders' section in the app.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">What happens if my delivery is late?</h4>
                <p className="text-slate-600">We strive to deliver on time. If your order is significantly delayed, please contact our support team for assistance.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">How do I cancel my order?</h4>
                <p className="text-slate-600">You can cancel your order within the first few minutes after placing it directly from the app. Once the restaurant accepts it, cancellation is no longer possible.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm h-fit">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Need more help?</h3>
            <p className="text-slate-600 mb-6">If you couldn't find the answer to your question, our support team is available 24/7 to assist you.</p>
            
            <div className="space-y-4">
              <a href="/contact" className="block w-full text-center bg-rose-500 text-white font-bold py-3 rounded-lg hover:bg-rose-600 transition-colors">
                Contact Support
              </a>
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-slate-500">Or email us directly at</p>
                <p className="text-rose-500 font-medium mt-1">{supportEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <FooterSection />
    </div>
  );
}

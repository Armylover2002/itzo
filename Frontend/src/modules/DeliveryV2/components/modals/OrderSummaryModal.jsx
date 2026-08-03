import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Wallet, History, Star } from 'lucide-react';

/**
 * OrderSummaryModal - Ported to Original White/Green Theme.
 * Post-delivery success screen.
 */
export const OrderSummaryModal = ({ order, onDone }) => {
  const earnings = order?.earnings || order?.riderEarning || order?.returnDeliveryCommission || (order?.orderAmount * 0.1) || 0;

  return (
    <div className="fixed inset-0 z-[160] bg-[#FE5502] overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm"
        >
          {/* Success Icon (White Style) */}
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce">
            <CheckCircle className="w-16 h-16 text-[#FE5502]" />
          </div>
          
          <h1 className="text-white text-5xl font-bold mb-2 tracking-tight">Well Done!</h1>
          <p className="text-white/90 text-lg mb-12">Trip completed successfully.</p>

          <div className="bg-white rounded-3xl p-8 mb-12 shadow-2xl text-gray-900 border border-white/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Earnings Added</p>
              <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
            </div>
            
            <p className="text-gray-950 text-6xl font-bold mb-6 tracking-tighter">₹{Number(earnings).toFixed(2)}</p>
            
            <div className="flex items-center justify-center gap-3 py-3 bg-orange-50 rounded-2xl text-orange-700 text-sm font-bold border border-orange-100">
              <Wallet className="w-5 h-5" />
              <span>Transferred to Wallet</span>
            </div>
          </div>

          <button 
            onClick={onDone}
            className="w-full h-16 bg-white text-[#FE5502] font-bold text-xl rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-xl shadow-black/10"
          >
            Go Back Home <ArrowRight className="w-6 h-6" />
          </button>

          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-12 opacity-80">
            Order Reference: {order?.orderId || order?.displayOrderId || 'FOD-1234'}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

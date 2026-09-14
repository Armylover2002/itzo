import React from 'react';
import { ChevronRight, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ActiveOrderPill = ({ order }) => {
    if (!order) return null;

    const cartCount = order.items.reduce((total, item) => total + item.quantity, 0);
    const displayItems = order.items.slice(0, 2);

    return (
        <AnimatePresence>
            <div
                className="fixed bottom-6 left-0 right-0 flex justify-center z-[55] pointer-events-none px-4"
            >
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-[240px] pointer-events-auto"
                >
                    <div
                        className="flex items-center gap-2 bg-slate-900 text-white py-1.5 px-2 pr-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.3)] border border-white/20 relative overflow-hidden"
                    >
                        {/* Status Shimmer */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: '200%' }}
                            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        />

                        {/* Product Avatars Stack */}
                        <div className="flex -space-x-3.5 relative z-10">
                            {displayItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="h-8 w-8 rounded-full border-2 border-slate-900 bg-white overflow-hidden shadow-sm"
                                    style={{ zIndex: 10 - index }}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-contain p-0.5"
                                    />
                                </div>
                            ))}
                            {order.items.length > 2 && (
                                <div className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[9px] font-bold z-0 text-white shadow-inner">
                                    +{order.items.length - 2}
                                </div>
                            )}
                        </div>

                        {/* Text Section */}
                        <div className="flex-1 flex flex-col justify-center min-w-0 relative z-10">
                            <h4 className="text-[11px] font-black leading-tight truncate uppercase tracking-tight">
                                {order.status === 'delivered' ? 'Delivered' : 'Order Tracking'}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold leading-tight">
                                {cartCount} {cartCount === 1 ? 'item' : 'items'} • ₹{order.pricing.total}
                            </p>
                        </div>

                        {/* Status Icon */}
                        <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 relative z-10">
                            <Package size={14} className="text-white" />
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ActiveOrderPill;

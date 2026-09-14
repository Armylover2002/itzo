import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Lottie from 'lottie-react';
import { useCart } from '@food/context/CartContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import shoppingCartAnimation from "@/assets/lottie/shopping-cart.json";

const MiniCart = ({
    className = "",
}) => {
    const { cart, getCartCount } = useCart();
    const cartCount = getCartCount();

    // Hide MiniCart on specific pages if needed
    // In Food module, we can just show it when cart has items

    return (
        <AnimatePresence>
            {cartCount > 0 && (
                <div
                    key="mini-cart-wrapper"
                    className={cn(
                        "fixed z-[55] pointer-events-none bottom-[80px] md:bottom-[calc(6rem-20px)] left-0 right-0 flex justify-center px-4",
                        className,
                    )}
                >
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="pointer-events-auto w-full max-w-[170px]"
                    >
                        <Link
                            to="/cart"
                            className={cn(
                                "flex items-center gap-2 text-white rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.3)] hover:scale-[1.05] active:scale-95 transition-all group border border-white/20 relative overflow-hidden py-1.5 px-2 bg-[#FF0000]",
                            )}
                        >
                            <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                                <div className="mini-cart-shimmer absolute inset-y-0 left-[-40%] w-[40%] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg]" />
                            </div>

                            {/* Item Image */}
                            <div className={cn(
                                "h-8 w-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden border border-gray-100",
                            )}>
                                {cart[0]?.image || cart[0]?.imageUrl ? (
                                    <img 
                                        src={cart[0].image || cart[0].imageUrl} 
                                        alt={cart[0].name} 
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <Lottie
                                        animationData={shoppingCartAnimation}
                                        loop
                                        className="pointer-events-none scale-[1.4] h-8 w-8"
                                    />
                                )}
                            </div>

                            {/* Text Section */}
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                <h4 className="font-bold leading-tight text-[13px] truncate text-white uppercase tracking-tighter">View cart</h4>
                                <p className="opacity-90 font-bold leading-tight text-[9px] text-white/95">
                                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                                </p>
                            </div>

                            {/* Arrow Icon in circle */}
                            <div className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 group-hover:bg-white/35 transition-colors">
                                <ChevronRight size={16} strokeWidth={3} className="text-white" />
                            </div>
                        </Link>
                    </motion.div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes mini-cart-shimmer {
                    0% { transform: translateX(-140%); }
                    100% { transform: translateX(320%); }
                }
                .mini-cart-shimmer {
                    animation: mini-cart-shimmer 2.8s ease-in-out infinite;
                }
            `}} />
        </AnimatePresence>
    );
};

export default MiniCart;

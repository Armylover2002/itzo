import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import Lottie from 'lottie-react';
import { useCart } from '@food/context/CartContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import shoppingCartAnimation from "@/assets/lottie/shopping-cart.json";

const RUPEE_SYMBOL = "₹";

const MiniCart = ({
    className = "",
}) => {
    const { cart, getCartCount, clearCart } = useCart();
    const cartCount = getCartCount();

    const summary = useMemo(() => {
        const items = Array.isArray(cart) ? cart : [];
        const first = items[0] || {};
        const sources = new Set(items.map((item) => item.sourceId || item.restaurantId || item.restaurant).filter(Boolean));
        const total = items.reduce(
            (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
            0,
        );
        const name = first.restaurant || first.sourceName || "Your cart";
        const menuTarget = first.orderType !== "quick" ? (first.restaurantSlug || first.restaurantId) : null;
        return {
            name: sources.size > 1 ? `${name} +${sources.size - 1} more` : name,
            image: first.restaurantImage || first.image || first.imageUrl || "",
            menuPath: menuTarget ? `/user/restaurants/${menuTarget}` : null,
            total: Math.round(total),
        };
    }, [cart]);

    const handleClearCart = () => {
        if (window.confirm("Remove all items from your cart?")) {
            clearCart();
        }
    };

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
                        initial={{ y: 50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="pointer-events-auto w-full max-w-md"
                    >
                        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 pl-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:border-gray-800 dark:bg-zinc-900">
                            {/* Restaurant logo */}
                            <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-gray-100 bg-white dark:border-gray-700">
                                {summary.image ? (
                                    <img src={summary.image} alt={summary.name} className="h-full w-full object-cover" />
                                ) : (
                                    <Lottie
                                        animationData={shoppingCartAnimation}
                                        loop
                                        className="pointer-events-none h-11 w-11 scale-[1.4]"
                                    />
                                )}
                            </div>

                            {/* Restaurant name + Menu link */}
                            <div className="min-w-0 flex-1">
                                <h4 className="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-white">
                                    {summary.name}
                                </h4>
                                {summary.menuPath && (
                                    <Link
                                        to={summary.menuPath}
                                        className="mt-1 inline-flex items-center gap-0.5 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB4F01] dark:bg-orange-500/15"
                                    >
                                        Menu
                                        <ChevronRight size={14} strokeWidth={2.5} />
                                    </Link>
                                )}
                            </div>

                            {/* Checkout */}
                            <Link
                                to="/cart"
                                className="flex-shrink-0 rounded-xl bg-green-600 px-4 py-1.5 text-center text-white shadow-sm transition-colors hover:bg-green-700 active:scale-95"
                            >
                                <span className="block text-[11px] font-medium leading-tight opacity-95">
                                    {cartCount} {cartCount === 1 ? 'item' : 'items'} | {RUPEE_SYMBOL}{summary.total}
                                </span>
                                <span className="block text-base font-bold leading-tight">Checkout</span>
                            </Link>

                            {/* Clear cart */}
                            <button
                                type="button"
                                onClick={handleClearCart}
                                aria-label="Clear cart"
                                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-colors hover:bg-red-100 active:scale-95 dark:bg-red-500/15"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default MiniCart;

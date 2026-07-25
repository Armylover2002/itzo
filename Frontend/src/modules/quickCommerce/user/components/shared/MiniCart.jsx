import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import Lottie from 'lottie-react';
import { useCart } from '../../context/CartContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import shoppingCartAnimation from "@/assets/lottie/shopping-cart.json";
import {
    getQuickCartPath,
    isEmbeddedQuickPath,
} from '../../utils/routes';

const MiniCart = ({
    position = "center",
    linkTo,
    className = "",
}) => {
    const { cart, cartCount } = useCart();
    const location = useLocation();

    // Show up to 2 product images
    const displayItems = cart.slice(0, 2);

    const path = location.pathname.replace(/\/$/, '') || '/';
    const normalizedQuickPath =
        path.replace(/^\/quick(?:-commerce(?:\/user)?)?/, '') || '/';
    const isEmbedded = isEmbeddedQuickPath(path);
    const resolvedLinkTo = linkTo || getQuickCartPath(path);

    // Hide MiniCart on checkout page, order details page, profile page, wallet, transactions, wishlist, addresses, support, privacy, and about page
    const isCheckoutPage = isEmbedded ? path === '/food/user/cart' : normalizedQuickPath === '/checkout';
    const isOrderDetailsPage = isEmbedded ? false : normalizedQuickPath.startsWith('/orders');
    const isProfilePage = isEmbedded ? false : normalizedQuickPath === '/profile';
    const isWalletPage = isEmbedded ? false : normalizedQuickPath === '/wallet';
    const isTransactionsPage = isEmbedded ? false : normalizedQuickPath === '/transactions';
    const isWishlistPage = isEmbedded ? false : normalizedQuickPath.startsWith('/wishlist');
    const isAddressesPage = isEmbedded ? false : normalizedQuickPath.startsWith('/addresses');
    const isSupportPage = isEmbedded ? false : normalizedQuickPath.startsWith('/support');
    const isPrivacyPage = isEmbedded ? false : normalizedQuickPath.startsWith('/privacy');
    const isAboutPage = isEmbedded ? false : normalizedQuickPath.startsWith('/about');
    const isBottomRight = position === "bottom-right";

    return (
        <AnimatePresence>
            {cartCount > 0 && !isCheckoutPage && !isOrderDetailsPage && !isProfilePage && !isWalletPage && !isTransactionsPage && !isWishlistPage && !isAddressesPage && !isSupportPage && !isPrivacyPage && !isAboutPage && (
                <div
                    key="mini-cart-wrapper"
                    id="mini-cart-target"
                    className={cn(
                        "fixed z-[100] pointer-events-none",
                        "bottom-[90px] right-4 md:bottom-10 md:right-10",
                        className,
                    )}
                >

                    <motion.div
                        initial="closed"
                        whileHover="open"
                        whileTap="open"
                        animate="closed"
                        className="pointer-events-auto"
                    >
                        <Link
                            to={resolvedLinkTo}
                            className="flex flex-col items-center justify-center w-[72px] h-[72px] md:w-[84px] md:h-[84px] bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-white rounded-full shadow-[0_15px_45px_rgba(0,0,0,0.5)] transition-all duration-300 relative group overflow-hidden border-2 border-white/10"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none" />

                            <motion.div
                                variants={{
                                    open: { scale: 0.9, rotate: -5 }
                                }}
                                className="relative flex flex-col items-center gap-0"
                            >
                                <div className="relative mb-0.5">
                                    {/* Solid Bag Icon with Propagated Animation */}
                                    <motion.svg
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="white"
                                        stroke="none"
                                    >
                                        {/* Bag Body (Trapezoid) */}
                                        <motion.path
                                            d="M6 10 L18 10 L19 22 C19 23 18 24 17 24 L7 24 C6 24 5 23 5 22 L6 10 Z"
                                            variants={{
                                                closed: { scaleY: 1, y: 0 },
                                                open: { scaleY: 0.9, y: 1 }
                                            }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                        />

                                        {/* Left Handle */}
                                        <motion.path
                                            d="M9 10 C9 10 9 4 12 4"
                                            fill="none"
                                            stroke="white"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            variants={{
                                                closed: { rotate: 0, x: 0, originX: "50%", originY: "100%" },
                                                open: { rotate: -45, x: -3, y: -1, originX: "50%", originY: "100%" }
                                            }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                        />

                                        {/* Right Handle */}
                                        <motion.path
                                            d="M15 10 C15 10 15 4 12 4"
                                            fill="none"
                                            stroke="white"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            variants={{
                                                closed: { rotate: 0, x: 0, originX: "50%", originY: "100%" },
                                                open: { rotate: 45, x: 3, y: -1, originX: "50%", originY: "100%" }
                                            }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                        />
                                    </motion.svg>

                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        whileHover={{ scale: 1.2 }}
                                        className="absolute -top-1 -right-2.5 w-5 h-5 bg-[#FFC107] text-black text-[11px] font-[1000] rounded-full flex items-center justify-center border-2 border-primary-dark shadow-lg z-10"
                                    >
                                        {cartCount}
                                    </motion.span>
                                </div>
                                <div className="flex flex-col items-center -space-y-0.5">
                                    <span className="text-[10px] font-medium tracking-wide leading-none">VIEW</span>
                                    <span className="text-[10px] font-medium tracking-wide leading-none">CART</span>
                                </div>
                            </motion.div>

                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                            </div>
                        </Link>
                    </motion.div>
                </div>
            )}
            <style>
                {`
                    @keyframes shimmer {
                        100% { transform: translateX(150%); }
                    }
                `}
            </style>
        </AnimatePresence>
    );
};

export default MiniCart;

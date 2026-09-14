import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { cn } from "@/lib/utils";
import {
    getQuickCartPath,
    isEmbeddedQuickPath,
} from "../../utils/routes";

// ─── Constants (module-level — never re-allocated) ────────────────────────────

const SHIMMER_STYLE = `
  @keyframes shimmer {
    100% { transform: translateX(150%) skewX(-12deg); }
  }
`;

const BAG_BODY_VARIANTS = {
    closed: { scaleY: 1, y: 0 },
    open: { scaleY: 0.9, y: 1 },
};
const BAG_BODY_TRANSITION = { type: "spring", stiffness: 400, damping: 20 };

const HANDLE_LEFT_VARIANTS = {
    closed: { rotate: 0, x: 0, originX: "50%", originY: "100%" },
    open: { rotate: -45, x: -3, y: -1, originX: "50%", originY: "100%" },
};
const HANDLE_RIGHT_VARIANTS = {
    closed: { rotate: 0, x: 0, originX: "50%", originY: "100%" },
    open: { rotate: 45, x: 3, y: -1, originX: "50%", originY: "100%" },
};

const BADGE_INITIAL = { scale: 0 };
const BADGE_ANIMATE = { scale: 1 };
const BADGE_HOVER = { scale: 1.2 };

const MOTION_INITIAL = "closed";
const MOTION_ANIMATE = "closed";

// Pages where MiniCart should be hidden (non-embedded)
const HIDDEN_NON_EMBEDDED_PATHS = [
    "/profile",
    "/wallet",
    "/transactions",
];
const HIDDEN_NON_EMBEDDED_PREFIXES = [
    "/orders",
    "/wishlist",
    "/addresses",
    "/support",
    "/privacy",
    "/about",
];

// ─── MiniCart ─────────────────────────────────────────────────────────────────

const MiniCart = React.memo(function MiniCart({
    position = "center",
    linkTo,
    className = "",
}) {
    const { cartCount } = useCart();
    const location = useLocation();

    const { shouldHide, resolvedLinkTo } = useMemo(() => {
        const path = location.pathname.replace(/\/$/, "") || "/";
        const normalizedQuickPath =
            path.replace(/^\/quick(?:-commerce(?:\/user)?)?/, "") || "/";
        const isEmbedded = isEmbeddedQuickPath(path);
        const resolvedLink = linkTo || getQuickCartPath(path);

        let hide = false;

        if (isEmbedded) {
            hide = path === "/food/user/cart";
        } else {
            hide =
                normalizedQuickPath === "/checkout" ||
                normalizedQuickPath === "/profile" ||
                normalizedQuickPath === "/wallet" ||
                normalizedQuickPath === "/transactions" ||
                HIDDEN_NON_EMBEDDED_PREFIXES.some((p) => normalizedQuickPath.startsWith(p));
        }

        return { shouldHide: hide, resolvedLinkTo: resolvedLink };
    }, [location.pathname, linkTo]);

    return (
        <>
            <style>{SHIMMER_STYLE}</style>
            <AnimatePresence>
                {cartCount > 0 && !shouldHide && (
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
                            initial={MOTION_INITIAL}
                            whileHover="open"
                            whileTap="open"
                            animate={MOTION_ANIMATE}
                            className="pointer-events-auto"
                        >
                            <Link
                                to={resolvedLinkTo}
                                className="flex flex-col items-center justify-center w-[72px] h-[72px] md:w-[84px] md:h-[84px] bg-black text-white rounded-full shadow-[0_15px_45px_rgba(0,0,0,0.5)] hover:scale-110 transition-all duration-300 relative group overflow-hidden border-2 border-white/10"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none" />

                                <motion.div
                                    variants={{ open: { scale: 0.9, rotate: -5 } }}
                                    className="relative flex flex-col items-center gap-0"
                                >
                                    <div className="relative mb-0.5">
                                        <motion.svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none">
                                            <motion.path
                                                d="M6 10 L18 10 L19 22 C19 23 18 24 17 24 L7 24 C6 24 5 23 5 22 L6 10 Z"
                                                variants={BAG_BODY_VARIANTS}
                                                transition={BAG_BODY_TRANSITION}
                                            />
                                            <motion.path
                                                d="M9 10 C9 10 9 4 12 4"
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                variants={HANDLE_LEFT_VARIANTS}
                                                transition={BAG_BODY_TRANSITION}
                                            />
                                            <motion.path
                                                d="M15 10 C15 10 15 4 12 4"
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                variants={HANDLE_RIGHT_VARIANTS}
                                                transition={BAG_BODY_TRANSITION}
                                            />
                                        </motion.svg>

                                        <motion.span
                                            initial={BADGE_INITIAL}
                                            animate={BADGE_ANIMATE}
                                            whileHover={BADGE_HOVER}
                                            className="absolute -top-1 -right-2.5 w-5 h-5 bg-[#FFC107] text-black text-[11px] font-[1000] rounded-full flex items-center justify-center border-2 border-black shadow-lg z-10"
                                        >
                                            {cartCount}
                                        </motion.span>
                                    </div>

                                    <div className="flex flex-col items-center -space-y-0.5">
                                        <span className="text-[10px] font-medium tracking-wide leading-none">VIEW</span>
                                        <span className="text-[10px] font-medium tracking-wide leading-none">CART</span>
                                    </div>
                                </motion.div>

                                {/* Shimmer */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                                </div>
                            </Link>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
});

export default MiniCart;
import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { cn } from "@/lib/utils";
import CartCheckoutBar from "@shared/components/CartCheckoutBar";
import {
    getQuickCartPath,
    getQuickShopPath,
    isEmbeddedQuickPath,
} from "../../utils/routes";

// Pages where MiniCart should be hidden (non-embedded)
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
    linkTo,
    className = "",
}) {
    const { cart, cartCount, cartTotal, clearCart } = useCart();
    const location = useLocation();

    const { shouldHide, resolvedLinkTo, isEmbedded } = useMemo(() => {
        const path = location.pathname.replace(/\/$/, "") || "/";
        const normalizedQuickPath =
            path.replace(/^\/quick(?:-commerce(?:\/user)?)?/, "") || "/";
        const embedded = isEmbeddedQuickPath(path);
        const resolvedLink = linkTo || getQuickCartPath(path);

        let hide = false;

        if (embedded) {
            hide = path === "/food/user/cart";
        } else {
            hide =
                normalizedQuickPath === "/checkout" ||
                normalizedQuickPath === "/profile" ||
                normalizedQuickPath === "/wallet" ||
                normalizedQuickPath === "/transactions" ||
                HIDDEN_NON_EMBEDDED_PREFIXES.some((p) => normalizedQuickPath.startsWith(p));
        }

        return { shouldHide: hide, resolvedLinkTo: resolvedLink, isEmbedded: embedded };
    }, [location.pathname, linkTo]);

    return (
        <AnimatePresence>
            {cartCount > 0 && !shouldHide && (
                <div
                    key="mini-cart-wrapper"
                    id="mini-cart-target"
                    className={cn(
                        "fixed z-[100] pointer-events-none bottom-[90px] md:bottom-10 left-0 right-0 flex justify-center px-4",
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
                        <CartCheckoutBar
                            items={cart}
                            count={cartCount}
                            total={cartTotal}
                            checkoutTo={resolvedLinkTo}
                            menuPath={isEmbedded ? null : getQuickShopPath()}
                            menuLabel="Shop"
                            onClear={clearCart}
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
});

export default MiniCart;

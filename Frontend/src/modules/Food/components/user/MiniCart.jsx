import React from 'react';
import { useCart } from '@food/context/CartContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import CartCheckoutBar from '@shared/components/CartCheckoutBar';

/** Food restaurant page for the first cart item ("Menu" chip), or null for quick items. */
export const getFoodCartMenuPath = (cart = []) => {
    const first = cart[0];
    if (!first || first.orderType === 'quick') return null;
    const target = first.restaurantSlug || first.restaurantId;
    return target ? `/user/restaurants/${target}` : null;
};

const MiniCart = ({
    className = "",
}) => {
    const { cart, getCartCount, clearCart } = useCart();
    const cartCount = getCartCount();

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
                        <CartCheckoutBar
                            items={cart}
                            count={cartCount}
                            checkoutTo="/cart"
                            menuPath={getFoodCartMenuPath(cart)}
                            onClear={clearCart}
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default MiniCart;

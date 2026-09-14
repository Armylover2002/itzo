import React, { useMemo } from 'react';
import Footer from './Footer';
import BottomNav from './BottomNav';
import MiniCart from '../shared/MiniCart';
import ProductDetailSheet from '../shared/ProductDetailSheet';
import { useProductDetail } from '../../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

// Static sets for O(1) lookups instead of Array.includes (O(n)) on every render
const HIDE_BOTTOM_NAV_SET = new Set(['/cart', '/checkout', '/search', '/chat']);
const HIDE_CART_SET = new Set(['/cart', '/checkout', '/search', '/chat']);

const CustomerLayout = ({
    children,
    showHeader: showHeaderProp,        // kept for API compat (unused internally)
    fullHeight = false,
    showCart: showCartProp,
    showBottomNav: showBottomNavProp,
}) => {
    const location = useLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();

    // Strip module prefix once per pathname change
    const path = useMemo(
        () => location.pathname.replace(/^\/quick(?:-commerce(?:\/user)?)?/, '') || '/',
        [location.pathname],
    );

    // All visibility flags derived in a single useMemo to avoid multiple hook calls
    const {
        showCart,
        finalShowBottomNavMobile,
    } = useMemo(() => {
        const matchesPrefix = (prefix) =>
            path === prefix || path.startsWith(`${prefix}/`);

        const _showBottomNav =
            showBottomNavProp !== undefined
                ? showBottomNavProp
                : !HIDE_BOTTOM_NAV_SET.has(path) && !matchesPrefix('/product');

        const _showCart =
            showCartProp !== undefined
                ? showCartProp
                : !HIDE_CART_SET.has(path) && !matchesPrefix('/orders');

        return {
            showCart: _showCart,
            finalShowBottomNavMobile: _showBottomNav && !isProductDetailOpen,
        };
    }, [path, showBottomNavProp, showCartProp, isProductDetailOpen]);

    return (
        <div className="quick-theme-scope min-h-screen bg-background flex flex-col font-sans">
            <main className={cn('flex-1 md:pb-0', !fullHeight && 'pb-16')}>
                {children}
            </main>

            {showCart && <MiniCart />}
            <ProductDetailSheet />

            <div className="hidden md:block">
                <Footer />
            </div>

            <div className="md:hidden">
                {finalShowBottomNavMobile && <BottomNav />}
            </div>
        </div>
    );
};

export default React.memo(CustomerLayout);

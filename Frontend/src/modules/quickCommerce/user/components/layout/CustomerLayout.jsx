import React from 'react';
import Footer from './Footer';
import BottomNav from './BottomNav';
import MiniCart from '../shared/MiniCart';
import ProductDetailSheet from '../shared/ProductDetailSheet';
import MobileFooterMessage from './MobileFooterMessage';
import { useProductDetail } from '../../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

const CustomerLayout = ({ children, showHeader: showHeaderProp, fullHeight = false, showCart: showCartProp, showBottomNav: showBottomNavProp }) => {
    const location = useLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();

    // Route-based visibility logic with module prefix stripping
    const path = location.pathname.replace(/^\/quick(?:-commerce(?:\/user)?)?/, '') || '/';

    const hideHeaderRoutes = ['/categories', '/category', '/orders', '/transactions', '/profile', '/profile/edit', '/wishlist', '/addresses', '/wallet', '/support', '/privacy', '/about', '/terms', '/checkout', '/search', '/chat', '/product', '/cart', '/returns'];
    const hideBottomNavRoutes = ['/cart', '/checkout', '/search', '/chat'];
    const hideCartRoutes = ['/cart', '/checkout', '/search', '/chat'];
    const matchesRoutePrefix = (routePrefix) =>
        path === routePrefix || path.startsWith(`${routePrefix}/`);

    const showBottomNav = showBottomNavProp !== undefined ? showBottomNavProp : (!hideBottomNavRoutes.includes(path) && !matchesRoutePrefix('/returns'));
    const showCart = showCartProp !== undefined ? showCartProp : (!hideCartRoutes.includes(path) && !matchesRoutePrefix('/orders'));

    // Condition to hide the MobileFooterMessage ("India's last minute app") on specific pages
    const hideFooterMessageRoutes = ['/profile', '/profile/edit'];
    const showFooterMessage = showBottomNav && !hideFooterMessageRoutes.includes(path) && !matchesRoutePrefix('/category') && !matchesRoutePrefix('/returns');

    const finalShowBottomNavMobile = showBottomNav && !isProductDetailOpen;
    const finalShowFooterMessageMobile = showFooterMessage && !isProductDetailOpen;

    return (
        <div className="quick-theme-scope min-h-screen bg-background flex flex-col font-sans">
            <main className={cn("flex-1 md:pb-0", !fullHeight && "pb-16")}>
                {children}
            </main>

            {showCart && <MiniCart />}
            <ProductDetailSheet />

            <div className="hidden md:block">
                <Footer />
            </div>

            {/* Mobile Footer Message logic */}
            <div className="md:hidden">
                {finalShowFooterMessageMobile && <MobileFooterMessage />}
            </div>

            {/* Bottom Nav logic */}
            <div className="md:hidden">
                {finalShowBottomNavMobile && <BottomNav />}
            </div>
            {/* Desktop Bottom Nav doesn't exist usually, but just in case of future changes */}
            <div className="hidden md:block">
                {showBottomNav && <BottomNav />}
            </div>
        </div>
    );
};

export default CustomerLayout;

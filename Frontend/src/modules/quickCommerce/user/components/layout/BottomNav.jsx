import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    getQuickCategoriesPath,
    getQuickHomePath,
    getQuickShopPath,
    getQuickProfilePath,
} from '../../utils/routes';

/**
 * Quick-commerce bottom navbar — different items from Food
 * (Home, Category, Shop, Profile).
 */
const BottomNav = () => {
    const location = useLocation();

    const isSharedQuickProfileRoute = useMemo(
        () =>
            location.pathname === '/profile' &&
            new URLSearchParams(location.search).get('from') === 'quick',
        [location.pathname, location.search],
    );

    const homePath = useMemo(
        () => getQuickHomePath(location.pathname),
        [location.pathname],
    );

    const navItems = useMemo(
        () => [
            { label: 'Home', icon: Home, path: homePath },
            { label: 'Category', icon: LayoutGrid, path: getQuickCategoriesPath() },
            { label: 'Shop', icon: ShoppingBag, path: getQuickShopPath() },
            { label: 'Profile', icon: User, path: getQuickProfilePath() },
        ],
        [homePath],
    );

    const activeStates = useMemo(() => {
        const profilePath = getQuickProfilePath();

        return navItems.map((item) => {
            if (item.path === profilePath && isSharedQuickProfileRoute) return true;

            if (item.label === 'Home') {
                return location.pathname === homePath;
            }

            return (
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`)
            );
        });
    }, [
        navItems,
        location.pathname,
        homePath,
        isSharedQuickProfileRoute,
    ]);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[500] pb-[env(safe-area-inset-bottom)] bg-white dark:bg-[#1a1a1a] md:hidden">
            <div className="relative bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 shadow-lg">
                <div className="flex items-center justify-around h-auto px-1 sm:px-2">
                    {navItems.map((item, idx) => {
                        const isActive = activeStates[idx];
                        return (
                            <React.Fragment key={item.label}>
                                {idx > 0 && (
                                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 shrink-0" />
                                )}
                                <Link
                                    to={item.path}
                                    state={
                                        item.label === 'Home'
                                            ? { categoryToSelect: 'all' }
                                            : undefined
                                    }
                                    className={cn(
                                        'flex flex-1 flex-col items-center gap-1.5 px-1.5 sm:px-2 py-2 transition-all duration-200 relative',
                                        isActive
                                            ? 'text-[#FF0000]'
                                            : 'text-gray-600 dark:text-gray-400',
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            'h-5 w-5',
                                            isActive
                                                ? 'text-[#FF0000] fill-[#FF0000]'
                                                : 'text-gray-600 dark:text-gray-400',
                                        )}
                                        strokeWidth={2}
                                    />
                                    <span
                                        className={cn(
                                            'text-[10px] sm:text-xs font-medium',
                                            isActive ? 'text-[#FF0000] font-semibold' : 'text-gray-600 dark:text-gray-400',
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#FF0000] rounded-b-full" />
                                    )}
                                </Link>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default React.memo(BottomNav);

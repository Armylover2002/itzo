import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Store, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getQuickCategoriesPath,
    getQuickHomePath,
    getQuickProfilePath,
} from '../../utils/routes';

const BottomNav = () => {
    const location = useLocation();
    const isSharedQuickProfileRoute =
        location.pathname === '/profile' &&
        new URLSearchParams(location.search).get('from') === 'quick';
    const navItems = [
        { label: 'Home', icon: Home, path: getQuickHomePath(location.pathname) },
        { label: 'Category', icon: LayoutGrid, path: getQuickCategoriesPath() },
        { label: 'Shop', icon: Store, path: '/quick/shops' },
        { label: 'Profile', icon: User, path: getQuickProfilePath() },
    ];
    const isActivePath = (targetPath) => {
        if (targetPath === getQuickProfilePath() && isSharedQuickProfileRoute) {
            return true;
        }
        if (targetPath === getQuickHomePath(location.pathname)) {
            return location.pathname === targetPath;
        }
        return location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-white/80 dark:bg-card/80 backdrop-blur-xl border-t border-gray-100 dark:border-border flex items-center justify-around h-[70px] md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-4 pb-[env(safe-area-inset-bottom)] transition-all duration-300">
            {navItems.map((item) => {
                const isActive = isActivePath(item.path);

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="flex-1 flex flex-col items-center justify-center h-full relative group transition-all"
                    >
                        <div className="flex flex-col items-center justify-center relative">
                            {/* Active Indicator Background (Subtle Glow) */}
                            {/* Active indicator background removed */}

                            <motion.div
                                animate={{
                                    y: isActive ? -2 : 0,
                                    scale: isActive ? 1.1 : 1
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                <item.icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "transition-colors duration-300",
                                        isActive ? "text-primary-orange" : "text-gray-400 dark:text-slate-500 group-hover:text-primary-hover group-active:text-primary-dark"
                                    )}
                                />
                            </motion.div>

                            <motion.span
                                animate={{
                                    y: isActive ? 1 : 0
                                }}
                                className={cn(
                                    "text-[10px] font-bold tracking-tight mt-1 transition-colors duration-300",
                                    isActive ? "text-primary-orange" : "text-gray-400 dark:text-slate-500 group-hover:text-primary-hover group-active:text-primary-dark"
                                )}
                            >
                                {item.label}
                            </motion.span>
                        </div>

                        {/* Top Accent Line for Active State */}
                        {isActive && (
                                <motion.div
                                    layoutId="topLine"
                                    className="absolute -top-[1px] w-8 h-[3px] bg-primary-orange rounded-full group-hover:bg-primary-hover group-active:bg-primary-dark transition-colors"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                        )}
                    </Link>
                );
            })}
        </div>
    );
};

export default BottomNav;

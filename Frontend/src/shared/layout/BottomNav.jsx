import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    HiOutlineSquares2X2,
    HiSquares2X2,
    HiOutlineClipboardDocumentList,
    HiClipboardDocumentList,
    HiOutlineCube,
    HiCube,
    HiOutlineWallet,
    HiWallet
} from 'react-icons/hi2';
import { useAuth } from '@/core/context/AuthContext';
import useKeyboardInset from '@food/hooks/useKeyboardInset';

const isEditableTarget = (target) => {
    if (!target) return false;
    const tag = String(target.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
};

const BottomNav = ({ navItems }) => {
    const { role } = useAuth();
    const location = useLocation();
    const keyboardInset = useKeyboardInset();
    const [fieldFocused, setFieldFocused] = React.useState(false);

    const isSellerPanel = location.pathname.startsWith('/seller');

    React.useEffect(() => {
        if (!isSellerPanel) return undefined;

        const onFocusIn = (event) => {
            if (isEditableTarget(event.target)) setFieldFocused(true);
        };
        const onFocusOut = () => {
            window.setTimeout(() => {
                if (!isEditableTarget(document.activeElement)) setFieldFocused(false);
            }, 40);
        };

        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        return () => {
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
        };
    }, [isSellerPanel]);

    const hideForKeyboard = isSellerPanel && (keyboardInset > 0 || fieldFocused);

    const primaryItems = role === 'admin' ? [
        { label: 'Dashboard', path: '/ecs', icon: HiOutlineSquares2X2, activeIcon: HiSquares2X2, end: true },
        { label: 'Orders', path: '/ecs/orders/all', icon: HiOutlineClipboardDocumentList, activeIcon: HiClipboardDocumentList },
        { label: 'Products', path: '/ecs/products', icon: HiOutlineCube, activeIcon: HiCube },
        { label: 'Wallet', path: '/ecs/wallet', icon: HiOutlineWallet, activeIcon: HiWallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: HiOutlineSquares2X2, activeIcon: HiSquares2X2, end: true },
        { label: 'Orders', path: '/seller/orders', icon: HiOutlineClipboardDocumentList, activeIcon: HiClipboardDocumentList },
        { label: 'Products', path: '/seller/products', icon: HiOutlineCube, activeIcon: HiCube },
        { label: 'Earnings', path: '/seller/earnings', icon: HiOutlineWallet, activeIcon: HiWallet },
    ];

    if (hideForKeyboard) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-white dark:bg-[#1a1a1a] border-t border-slate-200 dark:border-slate-800 shadow-lg pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around px-1 py-1">
                {primaryItems.map((item, index) => {
                    const Icon = item.icon;
                    const ActiveIcon = item.activeIcon;
                    return (
                        <React.Fragment key={item.path}>
                            {index > 0 && (
                                <div className="h-7 w-px bg-slate-200/80 dark:bg-slate-700/80 shrink-0" />
                            )}
                            <NavLink
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) => cn(
                                    "flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 relative transition-all select-none",
                                    isActive
                                        ? "text-red-600 dark:text-red-500 font-semibold"
                                        : "text-slate-600 dark:text-slate-400 font-normal hover:text-slate-900"
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-500 rounded-b-full" />
                                        )}
                                        {isActive ? (
                                            <ActiveIcon className="h-5 w-5 text-red-600 dark:text-red-500 fill-current" />
                                        ) : (
                                            <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                        )}
                                        <span className={cn(
                                            "text-xs leading-none",
                                            isActive ? "font-semibold text-red-600 dark:text-red-500" : "font-normal text-slate-600 dark:text-slate-400"
                                        )}>
                                            {item.label}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNav;


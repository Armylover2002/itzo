import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    Wallet,
    MoreHorizontal,
    ChevronDown,
    X
} from 'lucide-react';

import { useAuth } from '@/core/context/AuthContext';

const BottomNav = ({ navItems }) => {
    const { role } = useAuth();
    const location = useLocation();

    // Define the primary bottom nav items based on user role
    const primaryItems = role === 'admin' ? [
        { label: 'Dashboard', path: '/ecs', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/ecs/orders/all', icon: ClipboardList },
        { label: 'Products', path: '/ecs/products', icon: Box },
        { label: 'Wallet', path: '/ecs/wallet', icon: Wallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/seller/orders', icon: ClipboardList },
        { label: 'Products', path: '/seller/products', icon: Box },
        { label: 'Earnings', path: '/seller/earnings', icon: Wallet },
    ];

    return (
        <div className={cn(
            "fixed bottom-0 left-0 right-0 h-15 z-[60] md:hidden px-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-colors",
            role === 'seller' 
                ? "bg-[#FAF8F5] border-t border-[#EAE3D2] text-slate-600 font-['Roboto',sans-serif]" 
                : "bg-[#0a0c10] border-t border-white/5 text-gray-500"
        )}>
            {primaryItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => cn(
                        "flex flex-col items-center justify-center space-y-0.5 w-16 transition-all duration-300 py-1",
                        role === 'seller'
                            ? (isActive ? "text-[#E71D28] font-bold" : "text-slate-500 hover:text-[#E71D28]")
                            : (isActive ? "text-[#E71D28]" : "text-gray-500 hover:text-primary-hover")
                    )}
                >
                    <item.icon className="h-4 sm:h-5 w-4 sm:w-5" />
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
};

export default BottomNav;


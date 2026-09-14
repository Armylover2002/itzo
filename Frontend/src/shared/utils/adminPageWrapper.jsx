import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard wrapper for all admin pages
 * Ensures consistent spacing and animation
 */
export const AdminPageWrapper = ({ children, className }) => {
    return (
        <div className={cn("ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700", className)}>
            {children}
        </div>
    );
};

export default AdminPageWrapper;

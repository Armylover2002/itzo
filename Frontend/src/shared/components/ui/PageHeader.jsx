import React from 'react';
import { cn } from '@/lib/utils';

const PageHeader = ({ title, description, actions, badge, className }) => {
    return (
        <div className={cn("bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8", className)}>
            <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
                    {badge && badge}
                </div>
                {description && <p className="text-slate-600 text-xs sm:text-sm font-medium">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
};

export default PageHeader;

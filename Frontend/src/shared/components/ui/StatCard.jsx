import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';

const StatCard = ({ 
    label, 
    value, 
    icon: Icon, 
    trend, 
    trendDirection = 'up',
    description,
    color = 'text-blue-600',
    bg = 'bg-blue-50',
    cardBg,
    onClick,
    compact = false,
    className 
}) => {
    const clickable = Boolean(onClick);

    const handleKeyDown = (e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
        }
    };

    if (compact) {
        return (
            <div 
                onClick={onClick}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={handleKeyDown}
                className={cn(
                    "rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between",
                    cardBg || "bg-white border-slate-100",
                    onClick && "cursor-pointer active:scale-[0.98]",
                    className
                )}
            >
                <div className="flex items-center justify-between gap-1.5">
                    <div className={cn("rounded-lg p-1.5 sm:p-2 shrink-0 flex items-center justify-center shadow-xs", bg)}>
                        {Icon && <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", color)} strokeWidth={2} />}
                    </div>
                    {trend && (
                        <div className={cn(
                            "flex items-center text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0",
                            trendDirection === 'up' ? 'text-emerald-700 bg-emerald-100/80' : 'text-rose-700 bg-rose-100/80'
                        )}>
                            {trendDirection === 'up' ? (
                                <TrendingUp className="h-2.5 w-2.5 mr-0.5" strokeWidth={2.5} />
                            ) : (
                                <TrendingDown className="h-2.5 w-2.5 mr-0.5" strokeWidth={2.5} />
                            )}
                            {trend}
                        </div>
                    )}
                </div>

                <div className="mt-1.5">
                    <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate tracking-tight">{label}</p>
                    <div className="flex items-baseline justify-between gap-1 mt-0.5">
                        <p className="text-base sm:text-lg font-semibold tracking-tight text-[#1c1c1e] truncate">{value}</p>
                        {description && (
                            <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 truncate shrink-0">{description}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={onClick}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={handleKeyDown}
            className={cn(
                "rounded-2xl border p-3.5 sm:p-4.5 shadow-xs transition-all hover:shadow-sm",
                cardBg || "bg-white border-slate-100",
                onClick && "cursor-pointer active:scale-[0.98]",
                className
            )}
        >
            <div className="flex flex-col h-full justify-between gap-2.5 sm:gap-3.5">
                <div className="flex items-start justify-between">
                    <div className={cn("rounded-xl p-2 sm:p-2.5 shadow-xs", bg)}>
                        {Icon && <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", color)} strokeWidth={2} />}
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs font-medium text-slate-600">{label}</p>
                    <p className="text-lg sm:text-xl font-semibold tracking-tight text-[#1c1c1e]">{value}</p>
                </div>
                
                <div className="flex items-center justify-between gap-1 mt-0.5">
                    {description ? (
                        <p className="text-[11px] sm:text-xs font-normal text-slate-500 truncate">{description}</p>
                    ) : (
                        <div />
                    )}
                    
                    {trend && (
                        <div className={cn(
                            "flex items-center text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-lg shrink-0",
                            trendDirection === 'up' ? 'text-emerald-700 bg-emerald-100/80' : 'text-rose-700 bg-rose-100/80'
                        )}>
                            {trendDirection === 'up' ? (
                                <TrendingUp className="h-3 w-3 mr-1" strokeWidth={2.5} />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1" strokeWidth={2.5} />
                            )}
                            {trend}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;

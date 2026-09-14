import React from 'react';
import {
    Card as ShadcnCard,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from '@/lib/utils';

const Card = ({ children, title, subtitle, className, headerAction, footer, compact = false, contentClassName, headerClassName, ...props }) => {
    return (
        <ShadcnCard className={cn("glass-card border-none rounded-xl sm:rounded-2xl shadow-sm", className)} {...props}>
            {(title || subtitle || headerAction) && (
                <CardHeader className={cn(
                    "flex flex-row items-center justify-between space-y-0 border-b border-gray-100/50 bg-gray-50/20",
                    compact ? "px-3.5 py-2.5 sm:px-5 sm:py-3.5" : "px-5 py-4",
                    headerClassName
                )}>
                    <div className="space-y-0.5">
                        {title && <CardTitle className={cn("font-bold text-gray-900 tracking-tight", compact ? "text-sm sm:text-base" : "text-base")}>{title}</CardTitle>}
                        {subtitle && <CardDescription className={cn("font-medium text-gray-500", compact ? "text-[11px] sm:text-xs" : "text-xs")}>{subtitle}</CardDescription>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </CardHeader>
            )}
            <CardContent className={cn(compact ? "p-3 sm:p-5" : "p-5", !title && !subtitle && !headerAction && (compact ? "pt-3 sm:pt-5" : "pt-5"), contentClassName)}>
                {children}
            </CardContent>
            {footer && (
                <CardFooter className={cn("bg-gray-50/40 border-t border-gray-100/50", compact ? "px-3.5 py-2.5 sm:px-5 sm:py-3" : "px-5 py-3")}>
                    {footer}
                </CardFooter>
            )}
        </ShadcnCard>
    );
};

export default Card;


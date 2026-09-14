import React from 'react';
import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const Button = ({
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    ...props
}) => {
    // Map internal variants to shadcn variants
    const variantMap = {
        primary: 'default',
        secondary: 'secondary',
        danger: 'destructive',
        ghost: 'ghost',
        outline: 'outline',
    };

    const sizeMap = {
        sm: 'sm',
        md: 'default',
        lg: 'lg',
    };

    return (
        <ShadcnButton
            className={cn(className)}
            variant={variantMap[variant] || 'default'}
            size={sizeMap[size] || 'default'}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </ShadcnButton>
    );
};

export default Button;


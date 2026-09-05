import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', className }) => {
    const sizes = {
        sm: 'max-w-md sm:max-w-md',
        md: 'max-w-lg sm:max-w-lg',
        lg: 'max-w-2xl sm:max-w-2xl',
        xl: 'max-w-4xl sm:max-w-4xl',
        '2xl': 'max-w-5xl sm:max-w-5xl',
        full: 'max-w-[95vw] sm:max-w-[95vw] h-[95vh]',
    };

    React.useEffect(() => {
        if (isOpen) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        } else {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        };
    }, [isOpen]);
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn("overflow-hidden p-0 w-full", sizes[size] || sizes.md, className)}>
                <DialogHeader className="px-6 pt-3 pb-2 border-b border-gray-100/50 bg-gray-50/10">
                    <DialogTitle className="text-2xl font-semibold text-gray-900">{title}</DialogTitle>
                    <DialogDescription className="sr-only">Modal content</DialogDescription>
                </DialogHeader>

                <div
                    className="px-6 pt-3 pb-5 max-h-[80vh] overflow-y-auto overscroll-contain touch-pan-y"
                    tabIndex={0}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    {children}
                </div>

                {footer && (
                    <DialogFooter className="px-6 py-4 bg-gray-50/30 border-t border-gray-100/50 sm:justify-end gap-3">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default Modal;


import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';



const ToastContext = createContext(undefined);

export const ToastProvider = ({ children }) => {
    const showToast = (message, type = 'info') => {
        switch (type) {
            case 'success':
                toast.success(message);
                break;
            case 'error':
                toast.error(message);
                break;
            case 'warning':
                toast.warning(message);
                break;
            case 'info':
            default:
                toast.info(message);
                break;
        }
    };


    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};


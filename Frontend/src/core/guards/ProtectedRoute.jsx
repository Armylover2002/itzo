import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        if (location.pathname.startsWith('/ecs')) {
            return <Navigate to="/ecs/login" state={{ from: location }} replace />;
        }
        if (location.pathname.startsWith('/seller')) {
            return <Navigate to="/seller/auth" state={{ from: location }} replace />;
        }
        if (location.pathname.startsWith('/delivery')) {
            return <Navigate to="/delivery/auth" state={{ from: location }} replace />;
        }
        return <Navigate to="/user/auth/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

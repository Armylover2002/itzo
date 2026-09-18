import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { Loader } from 'lucide-react';

const HrmsGuard = ({ children }) => {
    const { user, isAuthenticated, isLoading, role } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <Loader className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/hrms/login" state={{ from: location }} replace />;
    }

    if (user?.role !== 'HRMS_EMPLOYEE') {
        // If an Admin/Seller/User tries to access the HRMS employee portal
        // Route them back to their respective dashboards.
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
            return <Navigate to="/ecs" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default HrmsGuard;

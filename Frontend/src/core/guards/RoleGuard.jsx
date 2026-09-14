import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';

const RoleGuard = ({ children, allowedRoles }) => {
    const { role, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null; // Let ProtectedRoute handle the loading spinner
    }

    if (!isAuthenticated || !role || !allowedRoles.includes(role)) {
        // Redirect to their respective dashboard if they are logged in but trying to access the wrong area
        if (isAuthenticated && role) {
            return <Navigate to={`/${role}`} replace />;
        }
        return <Navigate to="/unauthorized" replace />;
    }

    return <>{children}</>;
};

export default RoleGuard;

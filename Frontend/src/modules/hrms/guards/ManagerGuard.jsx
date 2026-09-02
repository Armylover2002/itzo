import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { useAuth } from '@core/context/AuthContext';
import { Loader } from 'lucide-react';

const ManagerGuard = ({ children }) => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isManager, setIsManager] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const checkRole = async () => {
            if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                if (isMounted) {
                    setIsManager(true);
                    setIsLoading(false);
                }
                return;
            }

            try {
                const res = await axiosInstance.get('/hrms/employees/me');
                const emp = res.data?.data?.employee;
                if (isMounted) {
                    setIsManager(emp?.hrmsRole === 'Manager');
                }
            } catch (error) {
                if (isMounted) {
                    setIsManager(false);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        checkRole();
        return () => { isMounted = false; };
    }, [user]);

    if (isLoading) {
        return (
            <div className="flex h-64 w-full items-center justify-center bg-transparent">
                <Loader className="w-8 h-8 text-[#6412c6] animate-spin" />
            </div>
        );
    }

    if (!isManager) {
        return <Navigate to="/hrms/dashboard" replace />;
    }

    return <>{children}</>;
};

export default ManagerGuard;

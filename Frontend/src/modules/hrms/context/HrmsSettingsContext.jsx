import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';

const HrmsSettingsContext = createContext(undefined);

const DEFAULT_SETTINGS = {
    companyName: 'ItzoFood',
    companyAddress: '123 Tech Park, Bangalore, India',
    supportEmail: 'support@itzofood.com',
    supportPhone: '',
    companyLogoUrl: '',
    currency: 'INR',
    currencySymbol: '₹',
    organization: {
        departments: [
            { name: 'Engineering' },
            { name: 'Sales' },
            { name: 'Operations' },
            { name: 'HR' },
            { name: 'Marketing' },
            { name: 'Finance' }
        ],
        designations: [
            'Junior Associate', 'Associate', 'Senior Associate',
            'Team Lead', 'Manager', 'Senior Manager', 'Director'
        ],
        officeLocations: [{ name: 'Head Office', isActive: true }],
        zones: []
    },
    shifts: [
        { name: 'General', startTime: '09:00', endTime: '18:00' },
        { name: 'Morning', startTime: '06:00', endTime: '14:00' },
        { name: 'Evening', startTime: '14:00', endTime: '22:00' }
    ]
};

export const HrmsSettingsProvider = ({ children }) => {
    const [hrmsSettings, setHrmsSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/hrms/settings/public');
            const data = res.data?.data;
            if (data) {
                setHrmsSettings({ ...DEFAULT_SETTINGS, ...data });
            }
        } catch (err) {
            console.error('Failed to fetch HRMS public settings', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return (
        <HrmsSettingsContext.Provider value={{ hrmsSettings, loading, refetchHrmsSettings: fetchSettings }}>
            {children}
        </HrmsSettingsContext.Provider>
    );
};

export const useHrmsSettings = () => {
    const context = useContext(HrmsSettingsContext);
    if (context === undefined) {
        throw new Error('useHrmsSettings must be used within an HrmsSettingsProvider');
    }
    return context;
};

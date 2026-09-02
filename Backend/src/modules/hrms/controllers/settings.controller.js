import { HrmsSettings } from '../models/settings.model.js';
import { GlobalSettings } from '../../common/models/settings.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * Get HRMS settings (creates defaults if none exist)
 */
export const getSettings = async (req, res, next) => {
    try {
        let settings = await HrmsSettings.findOne();

        if (!settings) {
            // Initialize with defaults
            settings = new HrmsSettings({
                workingHours: { minimumWorkingHours: 8, gracePeriodMinutes: 15, shortHourDeductionRate: 1, overtimeRate: 1.5 },
                leavePolicies: {
                    paidLeavesPerMonth: 4,
                    maxAccumulatedLeaves: 48,
                    leaveTypes: [
                        { name: 'Casual Leave', isPaid: true },
                        { name: 'Sick Leave', isPaid: true },
                        { name: 'Personal Leave', isPaid: true },
                        { name: 'Loss of Pay', isPaid: false }
                    ],
                    requiresManagerApproval: true
                },
                payrollRules: { lopMultiplier: 1, salaryCalculationType: 'Attendance_Based', payPeriod: 'Monthly' },
                expensePolicies: {
                    categories: ['Travel', 'Hotel', 'Food', 'Client Meeting', 'Other'],
                    maxHotelAllowancePerNight: 2000,
                    maxFoodAllowancePerDay: 500,
                    travelRatePerKm: 5,
                    requiresReceiptAbove: 500
                },
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
                    officeLocations: [{ name: 'Head Office' }],
                    zones: []
                },
                shifts: [
                    { name: 'General', startTime: '09:00', endTime: '18:00' },
                    { name: 'Morning', startTime: '06:00', endTime: '14:00' },
                    { name: 'Evening', startTime: '14:00', endTime: '22:00' }
                ],
                documentTypes: ['Aadhaar', 'PAN', 'Offer Letter', 'Payslip', 'Certificate', 'Resume', 'Other'],
                holidayCalendar: []
            });
            await settings.save();
        }

        return sendResponse(res, 200, 'HRMS settings retrieved', settings);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Update entire settings
 */
export const updateSettings = async (req, res, next) => {
    try {
        const updateData = req.body;
        updateData.updatedBy = req.user.userId;

        let settings = await HrmsSettings.findOne();
        if (!settings) {
            settings = new HrmsSettings(updateData);
        } else {
            Object.assign(settings, updateData);
        }

        await settings.save();
        return sendResponse(res, 200, 'Settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Update a specific section of settings
 */
export const updateSettingsSection = async (req, res, next) => {
    try {
        const { section } = req.params;
        const data = req.body;

        const validSections = ['workingHours', 'leavePolicies', 'payrollRules', 'expensePolicies', 'organization', 'shifts', 'documentTypes', 'holidayCalendar', 'templates', 'companyInfo', 'trackingSettings'];
        if (!validSections.includes(section)) {
            return sendError(res, 400, `Invalid section. Valid sections: ${validSections.join(', ')}`);
        }

        let settings = await HrmsSettings.findOne();
        if (!settings) {
            settings = new HrmsSettings();
        }

        settings[section] = data;
        settings.updatedBy = req.user.userId;
        await settings.save();

        return sendResponse(res, 200, `${section} updated successfully`, settings[section]);
    } catch (error) {
        next(error);
    }
};

/**
 * PUBLIC: Get company branding, organization master, and shifts (for login/signup and onboarding forms before auth)
 */
export const getPublicSettings = async (req, res, next) => {
    try {
        let settings = await HrmsSettings.findOne().select('companyInfo organization shifts').lean();
        const globalSettings = await GlobalSettings.findOne().select('companyName adminLogo adminFavicon').lean();

        const defaultLogo = globalSettings?.adminLogo?.url || '';
        const defaultFavicon = globalSettings?.adminFavicon?.url || '';
        const defaultName = globalSettings?.companyName || 'ItzoFood';

        const info = {
            companyName: settings?.companyInfo?.companyName || defaultName,
            companyAddress: settings?.companyInfo?.companyAddress || '123 Tech Park, Bangalore, India',
            supportEmail: settings?.companyInfo?.supportEmail || 'support@itzofood.com',
            supportPhone: settings?.companyInfo?.supportPhone || '',
            companyLogoUrl: settings?.companyInfo?.companyLogoUrl || defaultLogo,
            companyFaviconUrl: defaultFavicon,
            currency: settings?.companyInfo?.currency || 'INR',
            currencySymbol: settings?.companyInfo?.currencySymbol || '₹'
        };
        const organization = settings?.organization || {
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
        };
        const shifts = settings?.shifts || [
            { name: 'General', startTime: '09:00', endTime: '18:00' },
            { name: 'Morning', startTime: '06:00', endTime: '14:00' },
            { name: 'Evening', startTime: '14:00', endTime: '22:00' }
        ];

        return sendResponse(res, 200, 'Public settings retrieved', { ...info, organization, shifts });
    } catch (error) {
        next(error);
    }
};

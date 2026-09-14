import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { AdminRole } from '../../../../core/admin/role.model.js';
import { FoodRefreshToken } from '../../../../core/refreshTokens/refreshToken.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { sendEmployeeCredentialsEmail } from '../../../../utils/email.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';
import { logger } from '../../../../utils/logger.js';
import mongoose from 'mongoose';

const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/;
const EMAIL_REGEX = /^[a-z0-9._%+-]+@gmail\.com$/;
const PHONE_REGEX = /^\+91\d{10}$/;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif']);

const normalizeNamePart = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').trim();

const generateEmployeeId = async () => {
    const lastEmployee = await FoodAdmin.findOne({ employeeId: /^EMPL\d+$/ })
        .sort({ employeeId: -1 })
        .select('employeeId')
        .lean();

    if (!lastEmployee || !lastEmployee.employeeId) {
        return 'EMPL0001';
    }

    const match = lastEmployee.employeeId.match(/^EMPL(\d+)$/);
    if (!match) {
        return 'EMPL0001';
    }

    const nextNum = parseInt(match[1], 10) + 1;
    return `EMPL${String(nextNum).padStart(4, '0')}`;
};

const validateEmployeePayload = ({ firstName, lastName, email, password, phone, roleId, zoneId, isEditMode, workType }) => {
    const normalizedFirstName = normalizeNamePart(firstName);
    const normalizedLastName = normalizeNamePart(lastName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedFirstName) {
        return 'First name is required';
    }
    if (!NAME_REGEX.test(normalizedFirstName)) {
        return 'First name can contain only letters and basic punctuation';
    }
    if (!normalizedLastName) {
        return 'Last name is required';
    }
    if (!NAME_REGEX.test(normalizedLastName)) {
        return 'Last name can contain only letters and basic punctuation';
    }
    if (!normalizedEmail) {
        return 'Email is required';
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        return 'Email must be a valid gmail.com address';
    }
    if (!normalizedPhone) {
        return 'Phone number is required';
    }
    if (!PHONE_REGEX.test(normalizedPhone)) {
        return 'Phone number must be in +91XXXXXXXXXX format';
    }
    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
        return 'Please select a valid role';
    }
    if (zoneId !== undefined && zoneId !== null && zoneId !== '' && zoneId !== 'All' && !mongoose.Types.ObjectId.isValid(zoneId)) {
        return 'Please select a valid zone';
    }
    if (!isEditMode) {
        if (!password) {
            return 'Password is required';
        }
        if (String(password).length < 8) {
            return 'Password must be at least 8 characters';
        }
    } else if (password && String(password).length < 8) {
        return 'Password must be at least 8 characters';
    }

    if (workType !== undefined && workType !== null && workType !== '' && workType !== 'Work From Home' && workType !== 'Work From Office') {
        return 'Please select a valid Work Type';
    }

    return null;
};

const validateEmployeeImage = (file) => {
    if (!file) return null;
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        return 'Employee image must be JPG, PNG, or GIF';
    }
    if (file.size > 2 * 1024 * 1024) {
        return 'Employee image size must be 2 MB or less';
    }
    return null;
};

export const createEmployee = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, roleId, zoneId, workType } = req.body;
        const validationError = validateEmployeePayload({ firstName, lastName, email, password, phone, roleId, zoneId, isEditMode: false, workType });
        if (validationError) {
            logger.warn(`Employee creation validation failed: ${validationError}`);
            return sendError(res, 400, validationError);
        }
        const imageValidationError = validateEmployeeImage(req.file);
        if (imageValidationError) {
            logger.warn(`Employee creation image validation failed: ${imageValidationError}`);
            return sendError(res, 400, imageValidationError);
        }
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);
        const normalizedFirstName = normalizeNamePart(firstName);
        const normalizedLastName = normalizeNamePart(lastName);

        // Check if employee exists
        const existing = await FoodAdmin.findOne({ email: normalizedEmail });
        if (existing) {
            logger.warn(`Employee creation failed: Email ${normalizedEmail} already exists`);
            return sendError(res, 400, 'Employee with this email already exists');
        }

        const existingPhone = await FoodAdmin.findOne({ phone: normalizedPhone });
        if (existingPhone) {
            logger.warn(`Employee creation failed: Phone ${normalizedPhone} already exists`);
            return sendError(res, 400, 'Employee with this phone number already exists');
        }

        let adminRole = null;
        adminRole = await AdminRole.findById(roleId);
        if (!adminRole) {
            logger.warn(`Employee creation failed: Selected role ${roleId} not found`);
            return sendError(res, 404, 'Selected role not found');
        }

        const employeeId = await generateEmployeeId();

        const employee = new FoodAdmin({
            name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
            email: normalizedEmail,
            password, // Password will be hashed in pre-save hook
            phone: normalizedPhone,
            role: 'EMPLOYEE',
            adminRoleId: roleId,
            zoneId: zoneId !== 'All' ? zoneId : null,
            isActive: true,
            employeeId,
            workType: workType || 'Work From Office'
        });

        if (req.file && req.file.buffer) {
            employee.profileImage = await uploadImageBuffer(req.file.buffer, 'admin/employees');
        }

        await employee.save();

        // Send email with credentials
        const loginUrl = 'http://localhost:5173/admin/login'; // Replace with env var if available
        const roleName = adminRole ? adminRole.roleName : 'Employee';
        await sendEmployeeCredentialsEmail(normalizedEmail, password, roleName, loginUrl, employeeId);

        return sendResponse(res, 201, 'Employee created successfully', employee);
    } catch (error) {
        logger.error(`Employee creation error: ${error.message}`);
        return sendError(res, 500, error.message);
    }
};

export const getEmployees = async (req, res) => {
    try {
        const employees = await FoodAdmin.find({ role: 'EMPLOYEE' })
            .populate('adminRoleId', 'roleName')
            .populate('zoneId', 'name zoneName')
            .sort({ createdAt: -1 });
        return sendResponse(res, 200, 'Employees fetched successfully', employees);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const updateEmployee = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, roleId, zoneId, password, workType } = req.body;
        const employeeId = req.params.id;
        const validationError = validateEmployeePayload({ firstName, lastName, email, password, phone, roleId, zoneId, isEditMode: true, workType });
        if (validationError) {
            logger.warn(`Employee update validation failed: ${validationError}`);
            return sendError(res, 400, validationError);
        }
        const imageValidationError = validateEmployeeImage(req.file);
        if (imageValidationError) {
            logger.warn(`Employee update image validation failed: ${imageValidationError}`);
            return sendError(res, 400, imageValidationError);
        }
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);
        const normalizedFirstName = normalizeNamePart(firstName);
        const normalizedLastName = normalizeNamePart(lastName);

        const employee = await FoodAdmin.findOne({ _id: employeeId, role: 'EMPLOYEE' });
        if (!employee) {
            logger.warn(`Employee update failed: Employee ${employeeId} not found`);
            return sendError(res, 404, 'Employee not found');
        }

        const emailOwner = await FoodAdmin.findOne({
            email: normalizedEmail,
            _id: { $ne: employeeId }
        });
        if (emailOwner) {
            logger.warn(`Employee update failed: Email ${normalizedEmail} already owned by another admin`);
            return sendError(res, 400, 'Employee with this email already exists');
        }

        const phoneOwner = await FoodAdmin.findOne({
            phone: normalizedPhone,
            _id: { $ne: employeeId }
        });
        if (phoneOwner) {
            logger.warn(`Employee update failed: Phone ${normalizedPhone} already owned by another admin`);
            return sendError(res, 400, 'Employee with this phone number already exists');
        }

        const adminRole = await AdminRole.findById(roleId);
        if (!adminRole) {
            logger.warn(`Employee update failed: Selected role ${roleId} not found`);
            return sendError(res, 404, 'Selected role not found');
        }

        employee.name = `${normalizedFirstName} ${normalizedLastName}`.trim();
        employee.email = normalizedEmail;
        employee.phone = normalizedPhone;
        employee.adminRoleId = roleId;
        employee.zoneId = zoneId !== 'All' ? zoneId : null;
        employee.workType = workType || 'Work From Office';
        if (password) employee.password = password;

        if (req.file && req.file.buffer) {
            employee.profileImage = await uploadImageBuffer(req.file.buffer, 'admin/employees');
        }

        await employee.save();
        return sendResponse(res, 200, 'Employee updated successfully', employee);
    } catch (error) {
        logger.error(`Employee update error: ${error.message}`);
        return sendError(res, 500, error.message);
    }
};

export const deleteEmployee = async (req, res) => {
    try {
        const employee = await FoodAdmin.findOneAndDelete({ _id: req.params.id, role: 'EMPLOYEE' });
        if (!employee) return sendError(res, 404, 'Employee not found');
        try {
            await FoodRefreshToken.deleteMany({ userId: employee._id });
        } catch (revokeError) {
            logger.warn(`Failed to revoke sessions after employee delete: ${revokeError.message}`);
        }
        return sendResponse(res, 200, 'Employee deleted successfully', employee);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const toggleEmployeeStatus = async (req, res) => {
    try {
        const employee = await FoodAdmin.findOne({ _id: req.params.id, role: 'EMPLOYEE' });
        if (!employee) return sendError(res, 404, 'Employee not found');
        
        employee.isActive = !employee.isActive;
        await employee.save();

        // Force logout inactive employees so stale tokens cannot be refreshed.
        if (!employee.isActive) {
            try {
                await FoodRefreshToken.deleteMany({ userId: employee._id });
            } catch (revokeError) {
                logger.warn(`Failed to revoke sessions after employee deactivation: ${revokeError.message}`);
            }
        }
        
        return sendResponse(res, 200, `Employee status changed to ${employee.isActive ? 'Active' : 'Inactive'}`, employee);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

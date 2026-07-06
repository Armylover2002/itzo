import { HrmsEmployee } from '../models/employee.model.js';
import { FoodAdmin } from '../../../core/admin/admin.model.js';
import { HrmsDocument } from '../models/document.model.js';
import { getNextSequence } from '../models/counter.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import mongoose from 'mongoose';

/**
 * ADMIN: Onboard a new employee directly from ECS (no joining request)
 */
export const createEmployee = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            fullName, email, phone, password,
            department, designation, managerId, employmentType, hrmsRole,
            joiningDate, shift, officeLocation, zone, ctc,
            aadhaarNumber, panNumber, accountHolderName, accountNumber, bankName, ifscCode, upiId,
            address, emergencyContact, qualification, experience,
            profilePhotoUrl, aadhaarPhotoUrl, panPhotoUrl, offerLetterUrl,
            employeeType, assignedOfficeLocationId
        } = req.body;

        if (!fullName || !email || !password || !joiningDate) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 400, 'Full name, email, password, and joining date are required');
        }

        // 1. Create base credentials in FoodAdmin
        const existingAdmin = await FoodAdmin.findOne({ email: email.toLowerCase().trim() }).session(session);
        if (existingAdmin) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 409, 'Email is already in use');
        }

        const newAdmin = new FoodAdmin({
            email: email.toLowerCase().trim(),
            password,
            name: fullName.trim(),
            phone: phone || '',
            profileImage: profilePhotoUrl || '',
            role: 'HRMS_EMPLOYEE',
            isActive: true
        });
        await newAdmin.save({ session });

        // 2. Generate Employee ID atomically
        const seq = await getNextSequence('employeeId', session);
        const employeeId = `ITZO-EMP-${String(seq).padStart(4, '0')}`;

        // 3. Create HRMS Employee Profile
        const newEmployee = new HrmsEmployee({
            adminId: newAdmin._id,
            employeeId,
            hrmsRole: hrmsRole || 'Employee',
            department,
            designation,
            managerId: managerId || null,
            employmentType: employmentType || 'Full-Time',
            joiningDate,
            shift: shift || 'General',
            officeLocation,
            zone,
            ctc: ctc || 0,
            profilePhotoUrl,
            employeeType: employeeType || 'Office',
            assignedOfficeLocationId: assignedOfficeLocationId || null,
            documents: {
                aadhaarNumber,
                aadhaarPhotoUrl,
                panNumber,
                panPhotoUrl,
                offerLetterUrl
            },
            bankDetails: {
                accountHolderName,
                accountNumber,
                bankName,
                ifscCode,
                upiId
            },
            address: address || {},
            emergencyContact: emergencyContact || {},
            qualification,
            experience,
            status: 'Active'
        });
        await newEmployee.save({ session });

        // 4. Create document records
        const docRecords = [];
        if (offerLetterUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'Offer Letter', name: 'Offer Letter', url: offerLetterUrl, uploadedBy: req.user.userId });
        }
        if (aadhaarPhotoUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'Aadhaar', name: 'Aadhaar Card', url: aadhaarPhotoUrl, uploadedBy: req.user.userId });
        }
        if (panPhotoUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'PAN', name: 'PAN Card', url: panPhotoUrl, uploadedBy: req.user.userId });
        }
        if (docRecords.length > 0) {
            await HrmsDocument.insertMany(docRecords, { session });
        }

        await session.commitTransaction();

        return sendResponse(res, 201, 'Employee onboarded successfully', {
            employeeId: newEmployee.employeeId,
            name: fullName,
            email
        });
    } catch (error) {
        await session.abortTransaction();
        if (error.code === 11000) {
            return sendError(res, 409, 'Duplicate record detected');
        }
        next(error);
    } finally {
        session.endSession();
    }
};

/**
 * ADMIN: Get all active employees with pagination
 */
export const getEmployees = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, department, status = 'Active', sortBy = 'createdAt', sortOrder = 'desc', employeeType } = req.query;

        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (department) {
            filter.department = department;
        }
        if (employeeType) {
            filter.employeeType = employeeType;
        }
        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { employeeId: regex },
                { department: regex },
                { designation: regex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const [employees, total] = await Promise.all([
            HrmsEmployee.find(filter)
                .populate('adminId', 'name email phone profileImage isActive')
                .populate({
                    path: 'managerId',
                    populate: { path: 'adminId', select: 'name email' }
                })
                .sort({ [sortBy]: sortDir })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsEmployee.countDocuments(filter)
        ]);

        // If search term, also match by admin name/email
        let finalEmployees = employees;
        if (search && employees.length === 0) {
            const regex = new RegExp(search, 'i');
            const adminMatches = await FoodAdmin.find({
                role: 'HRMS_EMPLOYEE',
                $or: [{ name: regex }, { email: regex }]
            }).select('_id').lean();

            if (adminMatches.length > 0) {
                const adminIds = adminMatches.map(a => a._id);
                const baseFilter = { ...filter };
                delete baseFilter.$or;
                baseFilter.adminId = { $in: adminIds };

                const [emps, cnt] = await Promise.all([
                    HrmsEmployee.find(baseFilter)
                        .populate('adminId', 'name email phone profileImage isActive')
                        .populate({ path: 'managerId', populate: { path: 'adminId', select: 'name email' } })
                        .sort({ [sortBy]: sortDir })
                        .skip(skip)
                        .limit(parseInt(limit))
                        .lean(),
                    HrmsEmployee.countDocuments(baseFilter)
                ]);
                finalEmployees = emps;
                return sendResponse(res, 200, 'Employees retrieved successfully', {
                    employees: finalEmployees,
                    pagination: { page: parseInt(page), limit: parseInt(limit), total: cnt, totalPages: Math.ceil(cnt / parseInt(limit)) }
                });
            }
        }

        return sendResponse(res, 200, 'Employees retrieved successfully', {
            employees: finalEmployees,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get single employee details
 */
export const getEmployeeById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const employee = await HrmsEmployee.findById(id)
            .populate('adminId', 'name email phone profileImage isActive')
            .populate({ path: 'managerId', populate: { path: 'adminId', select: 'name email' } });

        if (!employee) {
            return sendError(res, 404, 'Employee not found');
        }

        // Get documents
        const documents = await HrmsDocument.find({ employeeId: employee._id }).lean();

        return sendResponse(res, 200, 'Employee details retrieved', { employee, documents });
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get own profile
 */
export const getMyProfile = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId })
            .populate('adminId', 'name email phone profileImage')
            .populate({
                path: 'managerId',
                populate: { path: 'adminId', select: 'name email' }
            });

        if (!employee) {
            return sendError(res, 404, 'Employee profile not found');
        }

        const documents = await HrmsDocument.find({ employeeId: employee._id })
            .select('documentType name url createdAt')
            .lean();

        const employeeObj = employee.toObject();

        if (employeeObj.employeeType === 'Office') {
            const { HrmsSettings } = await import('../models/settings.model.js');
            const settings = await HrmsSettings.findOne().select('organization.officeLocations').lean();
            const offices = settings?.organization?.officeLocations || [];
            if (employeeObj.assignedOfficeLocationId) {
                employeeObj.assignedOfficeDetails = offices.find(o => String(o._id) === String(employeeObj.assignedOfficeLocationId) && o.isActive !== false);
            }
            if (!employeeObj.assignedOfficeDetails) {
                // If they don't have an assigned office, fallback is ANY active office with GPS
                employeeObj.assignedOfficeDetails = offices.find(o => o.latitude && o.longitude && o.isActive !== false);
            }
        }

        return sendResponse(res, 200, 'Profile retrieved successfully', { employee: employeeObj, documents });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Update employee details
 */
export const updateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const employee = await HrmsEmployee.findById(id);
        if (!employee) return sendError(res, 404, 'Employee not found');

        // Fields that can be updated
        const allowedFields = [
            'department', 'designation', 'managerId', 'employmentType', 'hrmsRole',
            'shift', 'officeLocation', 'zone', 'ctc',
            'bankDetails', 'address', 'emergencyContact', 'profilePhotoUrl',
            'documents', 'qualification', 'experience',
            'employeeType', 'assignedOfficeLocationId'
        ];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                employee[field] = updateData[field];
            }
        }

        await employee.save();

        // Sync name/phone with FoodAdmin if provided
        if (updateData.fullName || updateData.phone) {
            const adminUpdate = {};
            if (updateData.fullName) adminUpdate.name = updateData.fullName;
            if (updateData.phone) adminUpdate.phone = updateData.phone;
            await FoodAdmin.findByIdAndUpdate(employee.adminId, adminUpdate);
        }

        return sendResponse(res, 200, 'Employee updated successfully', employee);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Update employee status (Active/Suspended/Terminated/Resigned)
 */
export const updateEmployeeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const employee = await HrmsEmployee.findById(id);
        if (!employee) return sendError(res, 404, 'Employee not found');

        employee.status = status;
        await employee.save();

        // Sync with FoodAdmin isActive
        const isActive = status === 'Active';
        await FoodAdmin.findByIdAndUpdate(employee.adminId, { isActive });

        return sendResponse(res, 200, 'Employee status updated', employee);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get employee stats for HRMS dashboard
 */
export const getEmployeeStats = async (req, res, next) => {
    try {
        const [totalActive, totalSuspended, totalTerminated, departments, employeeTypes] = await Promise.all([
            HrmsEmployee.countDocuments({ status: 'Active' }),
            HrmsEmployee.countDocuments({ status: 'Suspended' }),
            HrmsEmployee.countDocuments({ status: { $in: ['Terminated', 'Resigned'] } }),
            HrmsEmployee.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$department', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            HrmsEmployee.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$employeeType', count: { $sum: 1 } } }
            ])
        ]);

        return sendResponse(res, 200, 'Employee stats retrieved', {
            totalActive,
            totalSuspended,
            totalTerminated,
            totalEmployees: totalActive + totalSuspended + totalTerminated,
            departments,
            employeeTypes
        });
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER: Get team members (reporting employees)
 */
export const getTeamMembers = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const team = await HrmsEmployee.find({ managerId: employee._id, status: 'Active' })
            .populate('adminId', 'name email phone profileImage')
            .lean();

        return sendResponse(res, 200, 'Team members retrieved', team);
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Request a profile update
 */
export const requestProfileUpdate = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (employee.profileEditStatus === 'Pending') {
            return sendError(res, 400, 'A profile edit request is already pending approval');
        }

        // Allowed fields for employee to edit
        const allowedFields = ['phone', 'address', 'emergencyContact', 'bankDetails', 'qualification', 'experience', 'profilePhotoUrl'];
        const requestedChanges = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                requestedChanges[field] = req.body[field];
            }
        }

        if (Object.keys(requestedChanges).length === 0) {
            return sendError(res, 400, 'No valid fields provided for update');
        }

        employee.pendingProfileEdit = requestedChanges;
        employee.profileEditStatus = 'Pending';
        employee.profileEditRejectionReason = '';

        await employee.save();
        return sendResponse(res, 200, 'Profile update requested successfully', employee);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get all pending profile edit requests
 */
export const getPendingProfileEdits = async (req, res, next) => {
    try {
        const edits = await HrmsEmployee.find({ profileEditStatus: 'Pending' })
            .populate('adminId', 'name email phone profileImage')
            .lean();

        return sendResponse(res, 200, 'Pending profile edits retrieved', edits);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Approve or reject profile edit
 */
export const approveProfileEdit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, rejectionReason } = req.body; // 'Approved' or 'Rejected'

        const employee = await HrmsEmployee.findById(id);
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (employee.profileEditStatus !== 'Pending') {
            return sendError(res, 400, 'No pending edit request found for this employee');
        }

        if (action === 'Approved') {
            const changes = employee.pendingProfileEdit || {};
            
            // Merge changes into employee
            for (const key in changes) {
                employee[key] = changes[key];
            }

            // Sync with FoodAdmin if phone or profilePhotoUrl changed
            const adminUpdate = {};
            if (changes.phone) adminUpdate.phone = changes.phone;
            if (changes.profilePhotoUrl) adminUpdate.profileImage = changes.profilePhotoUrl;
            
            if (Object.keys(adminUpdate).length > 0) {
                await FoodAdmin.findByIdAndUpdate(employee.adminId, adminUpdate);
            }

            employee.pendingProfileEdit = {};
            employee.profileEditStatus = 'None';
            employee.profileEditRejectionReason = '';
        } else if (action === 'Rejected') {
            employee.profileEditStatus = 'Rejected';
            employee.profileEditRejectionReason = rejectionReason || 'Your profile edit request was rejected by Admin.';
        } else {
            return sendError(res, 400, 'Invalid action');
        }

        await employee.save();
        return sendResponse(res, 200, `Profile edit ${action.toLowerCase()} successfully`, employee);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get all active managers for dropdowns
 */
export const getActiveManagers = async (req, res, next) => {
    try {
        const managers = await HrmsEmployee.find({ hrmsRole: { $in: ['Manager', 'HR'] }, status: 'Active' })
            .populate('adminId', 'name email profileImage')
            .select('adminId employeeId department designation')
            .lean();

        return sendResponse(res, 200, 'Active managers retrieved', managers);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Transfer employee to a new manager
 */
export const transferEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newManagerId } = req.body;

        const employee = await HrmsEmployee.findById(id);
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (String(employee.managerId) === String(newManagerId)) {
            return sendError(res, 400, 'Employee is already assigned to this manager');
        }

        // Close previous history
        if (employee.managerId && employee.teamHistory && employee.teamHistory.length > 0) {
            const lastIndex = employee.teamHistory.length - 1;
            if (!employee.teamHistory[lastIndex].removedAt) {
                employee.teamHistory[lastIndex].removedAt = new Date();
            }
        }

        // Assign new manager
        employee.managerId = newManagerId || null;
        if (newManagerId) {
            employee.teamHistory.push({
                managerId: newManagerId,
                assignedAt: new Date()
            });
        }

        await employee.save();
        return sendResponse(res, 200, 'Employee transferred successfully', employee);
    } catch (error) {
        next(error);
    }
};

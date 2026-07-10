import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { HrmsJoiningRequest } from '../models/joiningRequest.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { FoodAdmin } from '../../../core/admin/admin.model.js';
import { HrmsDocument } from '../models/document.model.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.model.js';
import { getNextSequence } from '../models/counter.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import { config } from '../../../config/env.js';

/**
 * PUBLIC: Employee self-registration → creates a Joining Request (NOT an active employee).
 */
export const submitJoiningRequest = async (req, res, next) => {
    try {
        const {
            fullName, email, phone, password,
            dateOfBirth, gender,
            address, aadhaarNumber, panNumber,
            qualification, experience,
            bankDetails, emergencyContact,
            department, designation, ctc, joiningDate,
            hrmsRole, shift, employmentType, officeLocation,
            profilePhotoUrl, aadhaarPhotoUrl, panPhotoUrl, resumeUrl,
            documents, employeeType
        } = req.body;

        // Validation
        if (!fullName || !email || !phone || !password) {
            return sendError(res, 400, 'Full name, email, phone, and password are required');
        }

        // Strict format validation
        if (!/^[A-Za-z\s]{2,50}$/.test(fullName.trim())) {
            return sendError(res, 400, 'Name must be 2-50 characters (letters and spaces only)');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
            return sendError(res, 400, 'Please provide a valid email address');
        }
        if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
            return sendError(res, 400, 'Phone must be a valid 10-digit Indian mobile number (starting with 6-9)');
        }
        if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ''))) {
            return sendError(res, 400, 'Aadhaar number must be exactly 12 digits');
        }
        if (panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) {
            return sendError(res, 400, 'PAN must be in format ABCDE1234F');
        }

        if (password.length < 6) {
            return sendError(res, 400, 'Password must be at least 6 characters');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedPhone = phone.trim();

        // Check duplicate email in joining requests (non-rejected)
        const existingRequest = await HrmsJoiningRequest.findOne({
            email: normalizedEmail,
            status: { $in: ['Pending', 'Under_Review', 'Approved', 'Info_Requested'] }
        });
        if (existingRequest) {
            return sendError(res, 409, 'A joining request with this email already exists');
        }

        // Check duplicate email in active admin accounts
        const existingAdmin = await FoodAdmin.findOne({ email: normalizedEmail });
        if (existingAdmin) {
            return sendError(res, 409, 'An account with this email already exists');
        }

        // Check duplicate phone across FoodAdmin & non-rejected joining requests
        const existingAdminPhone = await FoodAdmin.findOne({ phone: normalizedPhone });
        if (existingAdminPhone) {
            return sendError(res, 409, 'An account with this phone number already exists');
        }

        const existingPhoneRequest = await HrmsJoiningRequest.findOne({
            phone: normalizedPhone,
            status: { $in: ['Pending', 'Under_Review', 'Approved', 'Info_Requested'] }
        });
        if (existingPhoneRequest) {
            return sendError(res, 409, 'A joining request with this phone number already exists');
        }

        // Check duplicate Aadhaar/PAN if provided
        if (aadhaarNumber) {
            const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
            const dupAadhaar = await HrmsJoiningRequest.findOne({
                aadhaarNumber: cleanAadhaar,
                status: { $in: ['Pending', 'Under_Review', 'Approved', 'Info_Requested'] }
            });
            if (dupAadhaar) {
                return sendError(res, 409, 'A joining request with this Aadhaar number already exists');
            }
            const dupEmpAadhaar = await HrmsEmployee.findOne({ 'documents.aadhaarNumber': cleanAadhaar });
            if (dupEmpAadhaar) {
                return sendError(res, 409, 'An employee with this Aadhaar number already exists');
            }
        }

        if (panNumber) {
            const cleanPan = panNumber.trim().toUpperCase();
            const dupPan = await HrmsJoiningRequest.findOne({
                panNumber: cleanPan,
                status: { $in: ['Pending', 'Under_Review', 'Approved', 'Info_Requested'] }
            });
            if (dupPan) {
                return sendError(res, 409, 'A joining request with this PAN number already exists');
            }
            const dupEmpPan = await HrmsEmployee.findOne({ 'documents.panNumber': cleanPan });
            if (dupEmpPan) {
                return sendError(res, 409, 'An employee with this PAN number already exists');
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(config.bcryptSaltRounds || 10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate request ID atomically
        const seq = await getNextSequence('joiningRequestId');
        const requestId = `ITZO-JR-${String(seq).padStart(4, '0')}`;

        const newRequest = new HrmsJoiningRequest({
            requestId,
            fullName: fullName.trim().replace(/\s+/g, ' '),
            email: normalizedEmail,
            phone: normalizedPhone,
            password: hashedPassword,
            dateOfBirth,
            gender,
            address,
            aadhaarNumber: aadhaarNumber ? aadhaarNumber.replace(/\D/g, '') : '',
            aadhaarPhotoUrl,
            panNumber: panNumber ? panNumber.trim().toUpperCase() : '',
            panPhotoUrl,
            qualification,
            experience,
            bankDetails: {
                ...bankDetails,
                ifscCode: bankDetails?.ifscCode ? bankDetails.ifscCode.trim().toUpperCase() : ''
            },
            emergencyContact,
            department,
            designation,
            ctc: ctc ? Number(ctc) : 0,
            joiningDate,
            hrmsRole,
            shift,
            employmentType,
            officeLocation,
            assignedOfficeLocationId: req.body.assignedOfficeLocationId || null,
            employeeType: employeeType || 'Office',
            profilePhotoUrl,
            resumeUrl,
            documents: documents || [],
            status: 'Pending',
            statusHistory: [{
                status: 'Pending',
                changedAt: new Date(),
                reason: 'Application submitted'
            }]
        });

        await newRequest.save();

        // Return without password
        const response = newRequest.toObject();
        delete response.password;

        return sendResponse(res, 201, 'Joining request submitted successfully. Please wait for admin approval.', response);
    } catch (error) {
        if (error.code === 11000) {
            return sendError(res, 409, 'A request with this information already exists');
        }
        next(error);
    }
};

/**
 * PUBLIC: Check joining request status by email (for applicants to check)
 */
export const checkRequestStatus = async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email) {
            return sendError(res, 400, 'Email is required');
        }

        const request = await HrmsJoiningRequest.findOne({ email: email.toLowerCase().trim() })
            .select('requestId fullName email status rejectionReason infoRequestMessage createdAt reviewedAt')
            .sort({ createdAt: -1 });

        if (!request) {
            return sendError(res, 404, 'No joining request found for this email');
        }

        return sendResponse(res, 200, 'Request status retrieved', request);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get all joining requests with pagination, search, filters
 */
export const getAllJoiningRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { fullName: regex },
                { email: regex },
                { phone: regex },
                { requestId: regex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const [requests, total] = await Promise.all([
            HrmsJoiningRequest.find(filter)
                .select('-password')
                .populate('assessmentAttemptId')
                .sort({ [sortBy]: sortDir })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsJoiningRequest.countDocuments(filter)
        ]);

        // Ensure assessment attempt info is attached if not explicitly linked by ID
        for (const reqObj of requests) {
            if (!reqObj.assessmentAttemptId && (reqObj.email || reqObj.phone)) {
                const attempt = await AssessmentAttempt.findOne({
                    $or: [
                        { applicantEmail: reqObj.email },
                        { applicantPhone: reqObj.phone }
                    ]
                }).sort({ createdAt: -1 }).lean();
                if (attempt) {
                    reqObj.assessmentAttemptId = attempt;
                }
            }
        }

        // Get status counts
        const [pendingCount, approvedCount, rejectedCount, infoRequestedCount] = await Promise.all([
            HrmsJoiningRequest.countDocuments({ status: 'Pending' }),
            HrmsJoiningRequest.countDocuments({ status: 'Approved' }),
            HrmsJoiningRequest.countDocuments({ status: 'Rejected' }),
            HrmsJoiningRequest.countDocuments({ status: 'Info_Requested' })
        ]);

        return sendResponse(res, 200, 'Joining requests retrieved', {
            requests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            },
            counts: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                infoRequested: infoRequestedCount,
                total: pendingCount + approvedCount + rejectedCount + infoRequestedCount
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get single joining request details
 */
export const getJoiningRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = await HrmsJoiningRequest.findById(id)
            .select('-password')
            .populate('reviewedBy', 'name email')
            .populate('assessmentAttemptId')
            .lean();

        if (!request) {
            return sendError(res, 404, 'Joining request not found');
        }

        if (!request.assessmentAttemptId && (request.email || request.phone)) {
            const attempt = await AssessmentAttempt.findOne({
                $or: [
                    { applicantEmail: request.email },
                    { applicantPhone: request.phone }
                ]
            }).sort({ createdAt: -1 }).lean();
            if (attempt) {
                request.assessmentAttemptId = attempt;
            }
        }

        return sendResponse(res, 200, 'Joining request details retrieved', request);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Approve a joining request → creates FoodAdmin + HrmsEmployee records
 */
export const approveJoiningRequest = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const {
            department, designation, managerId, employmentType,
            joiningDate, shift, officeLocation, zone, ctc, hrmsRole,
            employeeType, assignedOfficeLocationId
        } = req.body;

        const request = await HrmsJoiningRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 404, 'Joining request not found');
        }

        if (request.status === 'Approved') {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 409, 'This request has already been approved');
        }

        if (request.status === 'Rejected') {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 400, 'Cannot approve a rejected request. Ask the applicant to reapply.');
        }

        // Double-check email isn't taken (race condition guard)
        const existingAdmin = await FoodAdmin.findOne({ email: request.email }).session(session);
        if (existingAdmin) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 409, 'An account with this email already exists');
        }

        // 1. Create FoodAdmin account
        // The FoodAdmin model has a pre-save hook that hashes passwords.
        // Since the joining request stores an already-hashed password,
        // we save with a temp password first, then bypass the hook with updateOne.
        const tempPassword = 'TEMP_' + Date.now();
        const newAdmin = new FoodAdmin({
            email: request.email,
            password: tempPassword,
            name: request.fullName,
            phone: request.phone,
            profileImage: request.profilePhotoUrl || '',
            role: 'HRMS_EMPLOYEE',
            isActive: true
        });
        await newAdmin.save({ session });

        // Now set the already-hashed password directly, bypassing pre-save hook
        await FoodAdmin.updateOne(
            { _id: newAdmin._id },
            { $set: { password: request.password } }
        ).session(session);

        // 2. Generate Employee ID atomically
        const seq = await getNextSequence('employeeId', session);
        const employeeId = `ITZO-EMP-${String(seq).padStart(4, '0')}`;

        // 3. Create HrmsEmployee record
        const newEmployee = new HrmsEmployee({
            adminId: newAdmin._id,
            employeeId,
            hrmsRole: hrmsRole || request.hrmsRole || 'Employee',
            department: department || request.department || '',
            designation: designation || request.designation || '',
            managerId: (hrmsRole === 'Manager' || (!hrmsRole && request.hrmsRole === 'Manager')) ? null : (managerId || null),
            employmentType: employmentType || request.employmentType || 'Full-Time',
            joiningDate: joiningDate || request.joiningDate || new Date(),
            shift: shift || request.shift || 'General',
            officeLocation: officeLocation || request.officeLocation || '',
            zone: zone || '',
            ctc: ctc || request.ctc || 0,
            profilePhotoUrl: request.profilePhotoUrl || '',
            resumeUrl: request.resumeUrl || '',
            employeeType: employeeType || request.employeeType || 'Office',
            assignedOfficeLocationId: assignedOfficeLocationId || request.assignedOfficeLocationId || null,
            documents: {
                aadhaarNumber: request.aadhaarNumber,
                aadhaarPhotoUrl: request.aadhaarPhotoUrl,
                panNumber: request.panNumber,
                panPhotoUrl: request.panPhotoUrl,
                resumeUrl: request.resumeUrl || ''
            },
            bankDetails: request.bankDetails || {},
            address: request.address || {},
            emergencyContact: request.emergencyContact || {},
            qualification: request.qualification || '',
            experience: request.experience || '',
            joiningRequestId: request._id,
            status: 'Active'
        });
        await newEmployee.save({ session });

        if (req.body.assignedTeamMembers && Array.isArray(req.body.assignedTeamMembers) && req.body.assignedTeamMembers.length > 0) {
            const teamEmps = await HrmsEmployee.find({
                _id: { $in: req.body.assignedTeamMembers },
                status: 'Active',
                hrmsRole: { $ne: 'Manager' }
            }).session(session);

            for (const teamEmp of teamEmps) {
                if (String(teamEmp._id) === String(newEmployee._id)) continue;
                if (teamEmp.managerId && teamEmp.teamHistory && teamEmp.teamHistory.length > 0) {
                    const lastIdx = teamEmp.teamHistory.length - 1;
                    if (!teamEmp.teamHistory[lastIdx].removedAt) {
                        teamEmp.teamHistory[lastIdx].removedAt = new Date();
                    }
                }
                teamEmp.managerId = newEmployee._id;
                teamEmp.teamHistory.push({
                    managerId: newEmployee._id,
                    assignedAt: new Date()
                });
                await teamEmp.save({ session });
            }
        }

        // 4. Create document records for uploaded docs
        const docRecords = [];
        if (request.aadhaarPhotoUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'Aadhaar', name: 'Aadhaar Card', url: request.aadhaarPhotoUrl, uploadedBy: req.user.userId, isVerified: true });
        }
        if (request.panPhotoUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'PAN', name: 'PAN Card', url: request.panPhotoUrl, uploadedBy: req.user.userId, isVerified: true });
        }
        if (request.resumeUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'Resume', name: 'Resume', url: request.resumeUrl, uploadedBy: req.user.userId, isVerified: true });
        }
        if (request.profilePhotoUrl) {
            docRecords.push({ employeeId: newEmployee._id, documentType: 'Other', name: 'Profile Photo', url: request.profilePhotoUrl, uploadedBy: req.user.userId, isVerified: true });
        }
        if (request.documents && request.documents.length > 0) {
            for (const doc of request.documents) {
                if (doc.url) {
                    docRecords.push({ employeeId: newEmployee._id, documentType: doc.type || 'Other', name: doc.name || 'Document', url: doc.url, uploadedBy: req.user.userId, isVerified: true });
                }
            }
        }
        if (docRecords.length > 0) {
            await HrmsDocument.insertMany(docRecords, { session });
        }

        // 5. Update joining request status
        request.status = 'Approved';
        request.reviewedBy = req.user.userId;
        request.reviewedAt = new Date();
        request.approvedEmployeeId = newEmployee._id;
        request.approvedAdminId = newAdmin._id;
        request.statusHistory.push({
            status: 'Approved',
            changedBy: req.user.userId,
            changedAt: new Date(),
            reason: 'Application approved by admin'
        });
        await request.save({ session });

        await session.commitTransaction();

        return sendResponse(res, 200, 'Joining request approved. Employee can now login.', {
            employeeId: newEmployee.employeeId,
            name: request.fullName,
            email: request.email
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

/**
 * ADMIN: Reject a joining request
 */
export const rejectJoiningRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        if (!rejectionReason || !rejectionReason.trim()) {
            return sendError(res, 400, 'Rejection reason is required');
        }

        const request = await HrmsJoiningRequest.findById(id);
        if (!request) {
            return sendError(res, 404, 'Joining request not found');
        }

        if (request.status === 'Approved') {
            return sendError(res, 400, 'Cannot reject an already approved request');
        }

        if (request.status === 'Rejected') {
            return sendError(res, 400, 'This request is already rejected');
        }

        request.status = 'Rejected';
        request.rejectionReason = rejectionReason.trim();
        request.reviewedBy = req.user.userId;
        request.reviewedAt = new Date();
        request.statusHistory.push({
            status: 'Rejected',
            changedBy: req.user.userId,
            changedAt: new Date(),
            reason: rejectionReason.trim()
        });

        await request.save();

        return sendResponse(res, 200, 'Joining request rejected', {
            requestId: request.requestId,
            status: 'Rejected'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Request more information from applicant
 */
export const requestMoreInfo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return sendError(res, 400, 'Message is required');
        }

        const request = await HrmsJoiningRequest.findById(id);
        if (!request) {
            return sendError(res, 404, 'Joining request not found');
        }

        if (request.status === 'Approved' || request.status === 'Rejected') {
            return sendError(res, 400, `Cannot request info for ${request.status.toLowerCase()} request`);
        }

        request.status = 'Info_Requested';
        request.infoRequestMessage = message.trim();
        request.reviewedBy = req.user.userId;
        request.statusHistory.push({
            status: 'Info_Requested',
            changedBy: req.user.userId,
            changedAt: new Date(),
            reason: message.trim()
        });

        await request.save();

        return sendResponse(res, 200, 'Information request sent', {
            requestId: request.requestId,
            status: 'Info_Requested'
        });
    } catch (error) {
        next(error);
    }
};

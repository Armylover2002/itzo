import mongoose from 'mongoose';
import { HrmsKpi } from '../models/kpi.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { KpiEngine } from '../services/kpiEngine.service.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * ADMIN: Create a new KPI
 */
export const createKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.create(req.body);
        return sendResponse(res, 201, 'KPI created successfully', kpi);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Update a KPI
 */
export const updateKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!kpi) return sendError(res, 404, 'KPI not found');
        return sendResponse(res, 200, 'KPI updated successfully', kpi);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get all KPIs
 */
export const getKpis = async (req, res, next) => {
    try {
        const kpis = await HrmsKpi.find().sort({ createdAt: -1 });
        return sendResponse(res, 200, 'KPIs retrieved', kpis);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Delete KPI
 */
export const deleteKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.findByIdAndDelete(req.params.id);
        if (!kpi) return sendError(res, 404, 'KPI not found');
        return sendResponse(res, 200, 'KPI deleted successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get My Dashboard
 */
export const getMyPerformance = async (req, res, next) => {
    try {
        const employeeId = req.hrmsEmployee._id;
        const { period, forceRecalculate } = req.query;

        const performance = await KpiEngine.evaluateEmployeePerformance(employeeId, period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Performance retrieved', performance);
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER: Get Team Dashboard
 */
export const getTeamPerformance = async (req, res, next) => {
    try {
        const managerId = req.hrmsEmployee._id;
        const { period, forceRecalculate } = req.query;

        const team = await HrmsEmployee.find({ managerId, status: 'Active' }).select('_id adminId employeeId designation').populate('adminId', 'name email profileImage').lean();
        
        let teamTotalScore = 0;
        let count = 0;
        const teamMembersPerformance = [];

        for (const member of team) {
            const perf = await KpiEngine.evaluateEmployeePerformance(member._id, period, forceRecalculate === 'true');
            teamMembersPerformance.push({
                member,
                performance: perf
            });
            teamTotalScore += perf.finalScore;
            count++;
        }

        const averageTeamScore = count > 0 ? (teamTotalScore / count).toFixed(2) : 0;

        return sendResponse(res, 200, 'Team performance retrieved', {
            teamSize: count,
            averageTeamScore: Number(averageTeamScore),
            teamMembersPerformance
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get Company Performance
 */
export const getCompanyPerformance = async (req, res, next) => {
    try {
        const { period } = req.query;
        // Simplified overview: pick top 20 employees or aggregate overall.
        // For production with thousands, you'd aggregate through cached KPI results.
        const employees = await HrmsEmployee.find({ status: 'Active' }).limit(50).populate('adminId', 'name').lean();
        
        const companyPerformance = [];
        for (const emp of employees) {
            const perf = await KpiEngine.evaluateEmployeePerformance(emp._id, period, false);
            companyPerformance.push({ employee: emp, performance: perf });
        }

        // Sort by final score
        companyPerformance.sort((a, b) => b.performance.finalScore - a.performance.finalScore);

        return sendResponse(res, 200, 'Company performance overview', {
            topPerformers: companyPerformance.slice(0, 5),
            lowPerformers: companyPerformance.slice(-5).reverse(),
            totalEvaluated: companyPerformance.length
        });
    } catch (error) {
        next(error);
    }
};

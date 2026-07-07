import mongoose from 'mongoose';
import { HrmsKpiCategory } from '../models/kpiCategory.model.js';
import { HrmsKpi } from '../models/kpi.model.js';
import { HrmsKpiResult } from '../models/kpiResult.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { KpiEngine } from '../services/kpiEngine.service.js';
import { sendResponse, sendError } from '../../../utils/response.js';

// ============================================================================
// KPI CATEGORY MANAGEMENT (ADMIN)
// ============================================================================

export const createKpiCategory = async (req, res, next) => {
    try {
        const category = await HrmsKpiCategory.create({
            ...req.body,
            createdBy: req.user?.userId
        });
        return sendResponse(res, 201, 'KPI Category created successfully', category);
    } catch (error) {
        next(error);
    }
};

export const updateKpiCategory = async (req, res, next) => {
    try {
        const category = await HrmsKpiCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!category) return sendError(res, 404, 'KPI Category not found');
        return sendResponse(res, 200, 'KPI Category updated successfully', category);
    } catch (error) {
        next(error);
    }
};

export const getKpiCategories = async (req, res, next) => {
    try {
        const categories = await HrmsKpiCategory.find({ isActive: true }).sort({ name: 1 });
        return sendResponse(res, 200, 'KPI Categories retrieved', categories);
    } catch (error) {
        next(error);
    }
};

export const deleteKpiCategory = async (req, res, next) => {
    try {
        const category = await HrmsKpiCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!category) return sendError(res, 404, 'KPI Category not found');
        return sendResponse(res, 200, 'KPI Category deleted successfully');
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// KPI MANAGEMENT (ADMIN)
// ============================================================================

export const createKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.create(req.body);
        return sendResponse(res, 201, 'KPI created successfully', kpi);
    } catch (error) {
        next(error);
    }
};

export const updateKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!kpi) return sendError(res, 404, 'KPI not found');
        return sendResponse(res, 200, 'KPI updated successfully', kpi);
    } catch (error) {
        next(error);
    }
};

export const getKpis = async (req, res, next) => {
    try {
        const kpis = await HrmsKpi.find().populate('categoryId').sort({ createdAt: -1 });
        return sendResponse(res, 200, 'KPIs retrieved', kpis);
    } catch (error) {
        next(error);
    }
};

export const deleteKpi = async (req, res, next) => {
    try {
        const kpi = await HrmsKpi.findByIdAndDelete(req.params.id);
        if (!kpi) return sendError(res, 404, 'KPI not found');
        return sendResponse(res, 200, 'KPI deleted successfully');
    } catch (error) {
        next(error);
    }
};

export const testKpiFormula = async (req, res, next) => {
    try {
        const { formulaExpression, sampleVariables } = req.body;
        if (!formulaExpression) return sendError(res, 400, 'Formula expression is required');

        const evaluatedScore = KpiEngine.evaluateSecureFormula(formulaExpression, sampleVariables || {});
        return sendResponse(res, 200, 'Formula evaluated successfully', {
            formulaExpression,
            sampleVariables,
            evaluatedScore
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EMPLOYEE & MANAGER PERFORMANCE DASHBOARDS
// ============================================================================

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

export const getTeamPerformance = async (req, res, next) => {
    try {
        const managerId = req.hrmsEmployee._id;
        const { period, forceRecalculate } = req.query;

        const teamPerformance = await KpiEngine.evaluateTeamPerformance(managerId, period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Team performance retrieved', teamPerformance);
    } catch (error) {
        next(error);
    }
};

export const getEmployeePerformanceById = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { period, forceRecalculate } = req.query;

        // Security check: If caller is manager (not admin), verify reporting hierarchy
        if (!req.user || !req.user.role || req.user.role !== 'Admin') {
            const callerId = req.hrmsEmployee?._id;
            if (!callerId) return sendError(res, 403, 'Unauthorized access');
            
            const targetEmp = await HrmsEmployee.findById(employeeId).select('managerId').lean();
            if (!targetEmp || targetEmp.managerId?.toString() !== callerId.toString()) {
                if (callerId.toString() !== employeeId.toString()) {
                    return sendError(res, 403, 'You can only view performance for your reporting team members.');
                }
            }
        }

        const performance = await KpiEngine.evaluateEmployeePerformance(employeeId, period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Employee performance retrieved', performance);
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ECS ADMIN ADVANCED ANALYTICS & HIERARCHICAL PERFORMANCE
// ============================================================================

export const getCompanyPerformance = async (req, res, next) => {
    try {
        const { period, forceRecalculate } = req.query;
        const companyData = await KpiEngine.evaluateCompanyPerformance(period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Company performance retrieved', companyData);
    } catch (error) {
        next(error);
    }
};

export const getDepartmentPerformance = async (req, res, next) => {
    try {
        const { department, period, forceRecalculate } = req.query;
        const deptData = await KpiEngine.evaluateDepartmentPerformance(department || 'All', period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Department performance retrieved', deptData);
    } catch (error) {
        next(error);
    }
};

export const getZonePerformance = async (req, res, next) => {
    try {
        const { zone, period, forceRecalculate } = req.query;
        const zoneData = await KpiEngine.evaluateZonePerformance(zone || 'All', period, forceRecalculate === 'true');
        return sendResponse(res, 200, 'Zone performance retrieved', zoneData);
    } catch (error) {
        next(error);
    }
};

export const getAnalyticsOverview = async (req, res, next) => {
    try {
        const { period, department, zone, managerId, employeeType, forceRecalculate } = req.query;

        // Build filter
        const empQuery = { status: 'Active' };
        if (department && department !== 'All') empQuery.department = department;
        if (zone && zone !== 'All') empQuery.zone = zone;
        if (managerId && managerId !== 'All') empQuery.managerId = managerId;
        if (employeeType && employeeType !== 'All') empQuery.employeeType = employeeType;

        const employees = await HrmsEmployee.find(empQuery)
            .select('_id adminId employeeId designation department zone managerId hrmsRole')
            .populate('adminId', 'name email profileImage')
            .lean();

        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();

        const evaluatedList = await KpiEngine.mapConcurrent(employees, 15, async (emp) => {
            const perf = await KpiEngine.evaluateEmployeePerformance(emp, period, forceRecalculate === 'true', allActiveKpis);
            return { employee: emp, performance: perf };
        });

        let totalScore = 0;
        let count = 0;
        let financials = {
            grossRevenue: 0,
            platformCharges: 0,
            gstAmount: 0,
            operationalCost: 0,
            employeeIncentive: 0,
            approvedExpenses: 0,
            netProfit: 0
        };

        const riskEmployees = [];
        const inactiveEmployees = [];

        for (const item of evaluatedList) {
            const { employee: emp, performance: perf } = item;
            totalScore += perf.finalScore;
            count++;

            if (perf.financialBreakdown) {
                financials.grossRevenue += perf.financialBreakdown.grossRevenue || 0;
                financials.platformCharges += perf.financialBreakdown.platformCharges || 0;
                financials.gstAmount += perf.financialBreakdown.gstAmount || 0;
                financials.operationalCost += perf.financialBreakdown.operationalCost || 0;
                financials.employeeIncentive += perf.financialBreakdown.employeeIncentive || 0;
                financials.approvedExpenses += perf.financialBreakdown.approvedExpenses || 0;
                financials.netProfit += perf.financialBreakdown.netProfit || 0;
            }

            // Check Risk: score < 50 or attrition risk score > 60
            if (perf.finalScore < 50 || (perf.aiReadyMetadata?.attritionRiskScore > 60)) {
                riskEmployees.push({ employee: emp, score: perf.finalScore, level: perf.performanceLevel?.levelName });
            }

            // Check Inactive: 0 achieved across all KPIs
            const totalAchieved = perf.results?.reduce((sum, r) => sum + (r.result?.achievedValue || 0), 0) || 0;
            if (totalAchieved === 0 && perf.finalScore === 0) {
                inactiveEmployees.push({ employee: emp, score: perf.finalScore });
            }
        }

        evaluatedList.sort((a, b) => b.performance.finalScore - a.performance.finalScore);
        const averageScore = count > 0 ? Number((totalScore / count).toFixed(2)) : 0;

        return sendResponse(res, 200, 'Analytics overview retrieved', {
            period: period || KpiEngine.getPeriodDates().period,
            totalEvaluated: count,
            averageScore,
            performanceLevel: KpiEngine.resolvePerformanceLevel(averageScore, {}),
            financialBreakdown: financials,
            topPerformers: evaluatedList.slice(0, 10),
            bottomPerformers: evaluatedList.slice(-10).reverse(),
            riskEmployees,
            inactiveEmployees,
            allPerformances: evaluatedList
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORT ENGINE (EXCEL / CSV / PDF DATA FORMATTER)
// ============================================================================

export const exportPerformanceReport = async (req, res, next) => {
    try {
        const { reportType = 'Employee', format = 'json', period, department, zone } = req.query;

        const empQuery = { status: 'Active' };
        if (department && department !== 'All') empQuery.department = department;
        if (zone && zone !== 'All') empQuery.zone = zone;

        const employees = await HrmsEmployee.find(empQuery)
            .select('_id adminId employeeId designation department zone hrmsRole')
            .populate('adminId', 'name email')
            .lean();

        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();

        const evaluatedList = await KpiEngine.mapConcurrent(employees, 15, async (emp) => {
            const perf = await KpiEngine.evaluateEmployeePerformance(emp, period, false, allActiveKpis);
            return { emp, perf };
        });

        const rows = [];
        for (const { emp, perf } of evaluatedList) {
            if (reportType === 'Revenue' || reportType === 'Profit') {
                rows.push({
                    EmployeeID: emp.employeeId || emp._id,
                    Name: emp.adminId?.name || 'N/A',
                    Department: emp.department || 'N/A',
                    Zone: emp.zone || 'N/A',
                    GrossRevenue: perf.financialBreakdown?.grossRevenue || 0,
                    PlatformCharges: perf.financialBreakdown?.platformCharges || 0,
                    GST: perf.financialBreakdown?.gstAmount || 0,
                    Incentives: perf.financialBreakdown?.employeeIncentive || 0,
                    OperationalCost: perf.financialBreakdown?.operationalCost || 0,
                    NetProfit: perf.financialBreakdown?.netProfit || 0,
                    ProfitMarginPct: `${perf.financialBreakdown?.profitMarginPercent || 0}%`,
                    PerformanceScore: `${perf.finalScore} pts`,
                    Level: perf.performanceLevel?.levelName || 'N/A'
                });
            } else {
                rows.push({
                    EmployeeID: emp.employeeId || emp._id,
                    Name: emp.adminId?.name || 'N/A',
                    Designation: emp.designation || 'N/A',
                    Department: emp.department || 'N/A',
                    Zone: emp.zone || 'N/A',
                    FinalScore: `${perf.finalScore} / 100`,
                    PerformanceLevel: perf.performanceLevel?.levelName || 'N/A',
                    TotalWeightage: `${perf.totalWeightage}%`,
                    GrossRevenue: `₹${perf.financialBreakdown?.grossRevenue || 0}`,
                    NetProfit: `₹${perf.financialBreakdown?.netProfit || 0}`
                });
            }
        }

        // Return formatted rows ready for frontend CSV/Excel/PDF generator
        return sendResponse(res, 200, `Exported ${reportType} report data`, {
            reportType,
            format,
            period: period || KpiEngine.getPeriodDates().period,
            generatedAt: new Date(),
            totalRecords: rows.length,
            rows
        });
    } catch (error) {
        next(error);
    }
};

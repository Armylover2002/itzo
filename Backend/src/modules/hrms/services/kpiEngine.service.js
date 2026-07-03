import mongoose from 'mongoose';
import { HrmsKpi } from '../models/kpi.model.js';
import { HrmsKpiResult } from '../models/kpiResult.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsAttendance } from '../models/attendance.model.js';

// Reusing Food Models
const getFoodModels = () => ({
    Restaurant: mongoose.model('FoodRestaurant'),
    Order: mongoose.model('FoodOrder'), // Ensure FoodOrder model is registered
});

/**
 * Core KPI Evaluation Engine
 * Evaluates configured KPIs for an employee for a specific date range.
 */
export class KpiEngine {
    
    /**
     * Get start and end dates for a period string (e.g. '2023-10')
     */
    static getPeriodDates(period) {
        if (!period) {
            // Default to current month
            const now = new Date();
            period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        
        const [year, month] = period.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        
        return { startDate, endDate, period };
    }

    /**
     * Evaluates a single metric provider dynamically
     */
    static async evaluateMetric(metricKey, employeeId, startDate, endDate, kpiTarget = 0) {
        const { Restaurant, Order } = getFoodModels();
        const employeeObjId = new mongoose.Types.ObjectId(employeeId);
        
        const dateFilter = { $gte: startDate, $lte: endDate };

        switch (metricKey) {
            case 'REST_ONBOARDED_COUNT': {
                return await Restaurant.countDocuments({
                    onboardedBy: employeeObjId,
                    createdAt: dateFilter
                });
            }

            case 'REST_APPROVED_COUNT': {
                return await Restaurant.countDocuments({
                    onboardedBy: employeeObjId,
                    status: 'approved',
                    approvedAt: dateFilter
                });
            }
            
            case 'REST_ASSIGNED_COUNT': {
                return await Restaurant.countDocuments({
                    assignedTo: employeeObjId,
                });
            }

            case 'REST_ACTIVE_COUNT': {
                // Active = Approved, isAcceptingOrders = true, not deleted, and min 1 order in the period
                // To keep it performant for now, we find all assigned restaurants that are approved and accepting orders
                const activeRestaurants = await Restaurant.find({
                    assignedTo: employeeObjId,
                    status: 'approved',
                    isAcceptingOrders: true,
                    isDeleted: false
                }).select('_id').lean();

                if (activeRestaurants.length === 0) return 0;

                // Admin configured minimum daily orders threshold check (if dynamic, could be fetched from settings)
                // For simplicity, we check if they had at least X orders in the period.
                const restIds = activeRestaurants.map(r => r._id);
                
                // Aggregate orders per restaurant
                const orderCounts = await Order.aggregate([
                    { $match: { restaurantId: { $in: restIds }, orderStatus: 'Delivered', createdAt: dateFilter } },
                    { $group: { _id: '$restaurantId', totalOrders: { $sum: 1 } } }
                ]);

                // Consider active if they have at least 1 order in the period (or threshold)
                const threshold = 1; // Can be pulled from ECS settings
                const activeCount = orderCounts.filter(r => r.totalOrders >= threshold).length;
                return activeCount;
            }

            case 'REVENUE_GENERATED': {
                const assignedRests = await Restaurant.find({ assignedTo: employeeObjId }).select('_id').lean();
                if (assignedRests.length === 0) return 0;

                const restIds = assignedRests.map(r => r._id);
                const revenueAgg = await Order.aggregate([
                    { $match: { restaurantId: { $in: restIds }, orderStatus: 'Delivered', createdAt: dateFilter } },
                    { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' } } }
                ]);
                return revenueAgg[0]?.totalRevenue || 0;
            }

            case 'ATTENDANCE_SCORE': {
                const totalWorkingDays = startDate.getDate() === 1 ? endDate.getDate() : 30; // Approximation for month
                const presentDays = await HrmsAttendance.countDocuments({
                    employeeId: employeeObjId,
                    date: dateFilter,
                    status: { $in: ['Present', 'Half_Day'] }
                });
                // Calculate percentage
                return (presentDays / totalWorkingDays) * 100;
            }

            default:
                return 0; // Unknown metric
        }
    }

    /**
     * Evaluate all active KPIs for an employee
     */
    static async evaluateEmployeePerformance(employeeId, periodStr, forceRecalculate = false) {
        const { startDate, endDate, period } = this.getPeriodDates(periodStr);
        
        const employee = await HrmsEmployee.findById(employeeId).lean();
        if (!employee) throw new Error('Employee not found');

        // Fetch active KPIs matching department and role
        const kpis = await HrmsKpi.find({
            isActive: true,
            $or: [
                { department: 'All' },
                { department: employee.department }
            ],
            $or: [
                { role: 'All' },
                { role: employee.hrmsRole }
            ]
        }).lean();

        let totalWeightage = 0;
        let finalScore = 0;
        const results = [];

        for (const kpi of kpis) {
            // Check cache unless forced
            let resultDoc = await HrmsKpiResult.findOne({ employeeId, kpiId: kpi._id, period });
            
            if (!resultDoc || forceRecalculate) {
                // Calculate
                let achieved = 0;
                let rawMetrics = {};
                
                try {
                    achieved = await this.evaluateMetric(kpi.metricKey, employeeId, startDate, endDate, kpi.target);
                } catch (err) {
                    console.error(`Error evaluating metric ${kpi.metricKey} for employee ${employeeId}:`, err);
                }

                // If metric returns a direct percentage score (like ATTENDANCE), cap it at 100.
                // Otherwise calculate against target
                let scorePercentage = 0;
                if (kpi.targetType === 'Percentage') {
                    scorePercentage = Math.min(100, achieved);
                } else if (kpi.target > 0) {
                    scorePercentage = Math.min(100, (achieved / kpi.target) * 100);
                }

                const weightedScore = (scorePercentage * kpi.weightage) / 100;

                // Save result
                const updateData = {
                    achievedValue: achieved,
                    targetValue: kpi.target,
                    scorePercentage: scorePercentage,
                    weightedScore: weightedScore,
                    rawMetrics,
                    calculatedAt: new Date()
                };

                resultDoc = await HrmsKpiResult.findOneAndUpdate(
                    { employeeId, kpiId: kpi._id, period },
                    { $set: updateData },
                    { upsert: true, new: true }
                ).lean();
            }

            totalWeightage += kpi.weightage;
            finalScore += resultDoc.weightedScore;
            results.push({
                kpi,
                result: resultDoc
            });
        }

        // Normalize final score if weightages don't add up to exactly 100
        let normalizedScore = totalWeightage > 0 ? (finalScore / totalWeightage) * 100 : 0;
        
        return {
            period,
            employeeId,
            totalWeightage,
            finalScore: Number(normalizedScore.toFixed(2)),
            results
        };
    }
}

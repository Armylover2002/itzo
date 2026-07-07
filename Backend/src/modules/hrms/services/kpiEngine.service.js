import mongoose from 'mongoose';
import { HrmsKpi } from '../models/kpi.model.js';
import { HrmsKpiResult } from '../models/kpiResult.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsAttendance } from '../models/attendance.model.js';
import { HrmsExpense } from '../models/expense.model.js';

// Reusing Food Models
const getFoodModels = () => ({
    Restaurant: mongoose.model('FoodRestaurant'),
    Order: mongoose.model('FoodOrder'),
});

/**
 * Core Enterprise KPI Evaluation Engine
 * Evaluates configured KPIs dynamically with secure AST/tokenizer math parsing,
 * multi-level aggregation, financial breakdowns, and AI-ready metadata.
 */
export class KpiEngine {
    
    /**
     * Get start and end dates for various period formats (Monthly, Yearly, etc.)
     */
    static getPeriodDates(period) {
        if (!period) {
            const now = new Date();
            period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        
        let startDate, endDate;
        if (period.includes('-W')) {
            // Weekly format e.g. 2023-W42
            const [yearStr, weekStr] = period.split('-W');
            const year = parseInt(yearStr);
            const week = parseInt(weekStr);
            const simple = new Date(year, 0, 1 + (week - 1) * 7);
            const dayOfWeek = simple.getDay();
            const start = simple;
            if (dayOfWeek <= 4) {
                start.setDate(simple.getDate() - simple.getDay() + 1);
            } else {
                start.setDate(simple.getDate() + 8 - simple.getDay());
            }
            startDate = new Date(start);
            endDate = new Date(start);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        } else if (period.includes('-Q')) {
            // Quarterly format e.g. 2023-Q3
            const [yearStr, qStr] = period.split('-Q');
            const year = parseInt(yearStr);
            const q = parseInt(qStr);
            const startMonth = (q - 1) * 3;
            startDate = new Date(year, startMonth, 1);
            endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
        } else if (period.length === 4) {
            // Yearly format e.g. 2023
            const year = parseInt(period);
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        } else {
            // Monthly format e.g. 2023-10
            const [year, month] = period.split('-');
            startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        }
        
        return { startDate, endDate, period };
    }

    /**
     * Secure Mathematical Expression Parser without eval()
     * Uses Shunting-Yard algorithm to evaluate expressions with variables, operators (+, -, *, /, ^, %), and parentheses.
     */
    static evaluateSecureFormula(expression, variables = {}) {
        if (!expression || typeof expression !== 'string') return 0;

        try {
            // 1. Replace variables with numerical values
            let parsedExpr = expression;
            const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
            for (const key of sortedKeys) {
                const val = Number(variables[key]) || 0;
                const regex = new RegExp(`\\b${key}\\b`, 'gi');
                parsedExpr = parsedExpr.replace(regex, val);
            }

            // Clean string
            parsedExpr = parsedExpr.replace(/[^0-9.\+\-\*\/\^\%\(\)]/g, ' ');

            // 2. Tokenize
            const tokens = [];
            let currentNumber = '';
            for (let i = 0; i < parsedExpr.length; i++) {
                const char = parsedExpr[i];
                if (char === ' ') {
                    if (currentNumber !== '') {
                        tokens.push(Number(currentNumber));
                        currentNumber = '';
                    }
                    continue;
                }
                if (/[0-9.]/.test(char)) {
                    currentNumber += char;
                } else if (/[+\-*/^%()]/.test(char)) {
                    if (currentNumber !== '') {
                        tokens.push(Number(currentNumber));
                        currentNumber = '';
                    }
                    if (char === '-' && (tokens.length === 0 || (typeof tokens[tokens.length - 1] === 'string' && tokens[tokens.length - 1] !== ')'))) {
                        currentNumber = '-';
                    } else {
                        tokens.push(char);
                    }
                }
            }
            if (currentNumber !== '' && currentNumber !== '-') {
                tokens.push(Number(currentNumber));
            }

            // 3. Shunting-Yard to RPN
            const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
            const outputQueue = [];
            const operatorStack = [];

            for (const token of tokens) {
                if (typeof token === 'number') {
                    outputQueue.push(token);
                } else if (token === '(') {
                    operatorStack.push(token);
                } else if (token === ')') {
                    while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                        outputQueue.push(operatorStack.pop());
                    }
                    if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] === '(') {
                        operatorStack.pop();
                    }
                } else if (precedence[token]) {
                    while (
                        operatorStack.length > 0 &&
                        precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
                    ) {
                        outputQueue.push(operatorStack.pop());
                    }
                    operatorStack.push(token);
                }
            }
            while (operatorStack.length > 0) {
                const op = operatorStack.pop();
                if (op !== '(' && op !== ')') outputQueue.push(op);
            }

            // 4. Evaluate RPN
            const evalStack = [];
            for (const token of outputQueue) {
                if (typeof token === 'number') {
                    evalStack.push(token);
                } else {
                    const b = evalStack.pop() || 0;
                    const a = evalStack.pop() || 0;
                    switch (token) {
                        case '+': evalStack.push(a + b); break;
                        case '-': evalStack.push(a - b); break;
                        case '*': evalStack.push(a * b); break;
                        case '/': evalStack.push(b === 0 ? 0 : a / b); break;
                        case '%': evalStack.push(b === 0 ? 0 : a % b); break;
                        case '^': evalStack.push(Math.pow(a, b)); break;
                        default: evalStack.push(0); break;
                    }
                }
            }

            const result = evalStack.length > 0 ? evalStack[0] : 0;
            return isNaN(result) || !isFinite(result) ? 0 : Number(result.toFixed(2));
        } catch (error) {
            console.error('Error evaluating secure formula expression:', expression, error);
            return 0;
        }
    }

    /**
     * Dynamically collect all 16 enterprise metrics for an employee in a period
     */
    static async collectEmployeeMetrics(employeeId, startDate, endDate, kpiTarget = 0, ruleConfig = {}) {
        const { Restaurant, Order } = getFoodModels();
        const employeeObjId = new mongoose.Types.ObjectId(employeeId);
        const dateFilter = { $gte: startDate, $lte: endDate };

        // 1. Restaurants Onboarded
        const restaurantsOnboarded = await Restaurant.countDocuments({
            onboardedBy: employeeObjId,
            createdAt: dateFilter
        });

        // 2. Active Restaurants (Configurable rules)
        const activeRules = ruleConfig?.activeRestaurantRules || {};
        const restQuery = { assignedTo: employeeObjId, isDeleted: false };
        if (activeRules.requireApproved !== false) restQuery.status = 'approved';
        if (activeRules.requireAcceptingOrders !== false) restQuery.isAcceptingOrders = true;
        
        const assignedRests = await Restaurant.find(restQuery).select('_id').lean();
        const restIds = assignedRests.map(r => r._id);
        
        let activeRestaurantsCount = 0;
        let monthlyOrdersCount = 0;
        let grossRevenueAmount = 0;

        if (restIds.length > 0) {
            const orderAgg = await Order.aggregate([
                { $match: { restaurantId: { $in: restIds }, orderStatus: 'Delivered', createdAt: dateFilter } },
                { $group: {
                    _id: '$restaurantId',
                    totalOrders: { $sum: 1 },
                    totalRev: { $sum: '$grandTotal' }
                }}
            ]);

            const minOrdersThreshold = activeRules.minOrders || ruleConfig?.minOrdersThreshold || 1;
            activeRestaurantsCount = orderAgg.filter(r => r.totalOrders >= minOrdersThreshold).length;
            
            for (const r of orderAgg) {
                monthlyOrdersCount += r.totalOrders;
                grossRevenueAmount += r.totalRev;
            }
        }

        const totalDaysInPeriod = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
        const dailyOrdersCount = Number((monthlyOrdersCount / totalDaysInPeriod).toFixed(2));

        // 3. Expenses Breakdown
        const expenses = await HrmsExpense.find({
            employeeId: employeeObjId,
            status: 'Approved',
            visitDate: dateFilter
        }).lean();

        let travelExpense = 0;
        let hotelExpense = 0;
        let foodExpense = 0;
        let otherExpense = 0;

        for (const exp of expenses) {
            travelExpense += Number(exp.travelCost) || 0;
            hotelExpense += Number(exp.hotelCost) || 0;
            foodExpense += Number(exp.foodCost) || 0;
            otherExpense += Number(exp.otherExpenses) || 0;
        }
        const totalApprovedExpenses = travelExpense + hotelExpense + foodExpense + otherExpense;

        // 4. Financial KPI Breakdown
        const platformCharges = Number((grossRevenueAmount * 0.05).toFixed(2)); // 5% default or configurable
        const gstAmount = Number((grossRevenueAmount * 0.05).toFixed(2)); // 5% GST
        const employeeIncentive = Number((grossRevenueAmount * 0.03).toFixed(2)); // 3% Incentive
        const operationalCost = totalApprovedExpenses;
        
        const netRevenue = Number((grossRevenueAmount - platformCharges - gstAmount).toFixed(2));
        const netProfit = Number((grossRevenueAmount - gstAmount - platformCharges - employeeIncentive - operationalCost).toFixed(2));
        const profitMarginPercent = grossRevenueAmount > 0 ? Number(((netProfit / grossRevenueAmount) * 100).toFixed(2)) : 0;

        // 5. Attendance & Discipline
        const attendanceRecords = await HrmsAttendance.find({
            employeeId: employeeObjId,
            date: dateFilter
        }).lean();

        let presentDays = 0;
        let leaveDays = 0;
        let shortHours = 0;

        for (const att of attendanceRecords) {
            if (att.status === 'Present') presentDays += 1;
            else if (att.status === 'Half_Day') presentDays += 0.5;
            else if (att.status === 'Leave' || att.status === 'LOP') leaveDays += 1;
            
            if (att.shortHours) shortHours += Number(att.shortHours) || 0;
        }

        const workingDays = Math.min(30, totalDaysInPeriod);
        const attendancePercentage = Number(Math.min(100, (presentDays / workingDays) * 100).toFixed(2));
        const leavePercentage = Number(Math.min(100, (leaveDays / workingDays) * 100).toFixed(2));

        return {
            RESTAURANTS_ONBOARDED: restaurantsOnboarded,
            ACTIVE_RESTAURANTS: activeRestaurantsCount,
            DAILY_ORDERS: dailyOrdersCount,
            MONTHLY_ORDERS: monthlyOrdersCount,
            GROSS_REVENUE: grossRevenueAmount,
            NET_REVENUE: netRevenue,
            NET_PROFIT: netProfit,
            ATTENDANCE_PERCENTAGE: attendancePercentage,
            LEAVE_PERCENTAGE: leavePercentage,
            SHORT_HOURS: shortHours,
            TRAVEL_EXPENSE: travelExpense,
            HOTEL_EXPENSE: hotelExpense,
            FOOD_EXPENSE: foodExpense,
            INCENTIVES: employeeIncentive,
            TARGET: kpiTarget,
            ACHIEVED: restaurantsOnboarded, // Default fallback
            // Financial breakdown structure
            financialBreakdown: {
                grossRevenue: grossRevenueAmount,
                platformCharges,
                gstAmount,
                operationalCost,
                employeeIncentive,
                approvedExpenses: totalApprovedExpenses,
                netProfit,
                profitMarginPercent
            }
        };
    }

    /**
     * Resolve achieved value based on metricKey
     */
    static resolveAchievedValue(metricKey, metrics) {
        switch (metricKey) {
            case 'REST_ONBOARDED_COUNT': return metrics.RESTAURANTS_ONBOARDED;
            case 'REST_ACTIVE_COUNT': return metrics.ACTIVE_RESTAURANTS;
            case 'ORDERS_GENERATED': return metrics.MONTHLY_ORDERS;
            case 'REVENUE_GENERATED': return metrics.GROSS_REVENUE;
            case 'FINANCE_NET_PROFIT': return metrics.NET_PROFIT;
            case 'ATTENDANCE_SCORE': return metrics.ATTENDANCE_PERCENTAGE;
            case 'DAILY_REPORT_SCORE': return metrics.ATTENDANCE_PERCENTAGE; // Proxy or actual report score
            default: return metrics.RESTAURANTS_ONBOARDED;
        }
    }

    /**
     * Determine performance level from score
     */
    static resolvePerformanceLevel(scorePercentage, kpi = {}) {
        const defaultLevels = [
            { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets and expectations.' },
            { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
            { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
            { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus and coaching.' },
            { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
        ];

        const levels = (kpi.performanceLevels && kpi.performanceLevels.length > 0) ? kpi.performanceLevels : defaultLevels;
        const found = levels.find(l => scorePercentage >= l.minScore && scorePercentage <= l.maxScore);
        return found || levels[2]; // Default to Average if not matched
    }

    /**
     * Bounded concurrent execution helper to prevent database connection exhaustion
     */
    static async mapConcurrent(items, limit, fn) {
        const results = [];
        for (let i = 0; i < items.length; i += limit) {
            const chunk = items.slice(i, i + limit);
            const chunkResults = await Promise.all(chunk.map(fn));
            results.push(...chunkResults);
        }
        return results;
    }

    /**
     * Evaluate all active KPIs for an employee
     */
    static async evaluateEmployeePerformance(employeeIdOrObj, periodStr, forceRecalculate = false, cachedKpis = null) {
        const { startDate, endDate, period } = this.getPeriodDates(periodStr);
        
        const employee = (typeof employeeIdOrObj === 'object' && employeeIdOrObj !== null && employeeIdOrObj._id)
            ? employeeIdOrObj
            : await HrmsEmployee.findById(employeeIdOrObj).lean();
            
        if (!employee) throw new Error('Employee not found');
        const employeeId = employee._id;

        let kpis;
        if (cachedKpis && Array.isArray(cachedKpis)) {
            kpis = cachedKpis.filter(k => 
                (k.department === 'All' || k.department === employee.department) &&
                (k.role === 'All' || k.role === employee.hrmsRole)
            );
        } else {
            kpis = await HrmsKpi.find({
                isActive: true,
                $or: [
                    { department: 'All' },
                    { department: employee.department }
                ],
                $or: [
                    { role: 'All' },
                    { role: employee.hrmsRole }
                ]
            }).populate('categoryId').lean();
        }

        let totalWeightage = 0;
        let finalScore = 0;
        const results = [];
        let aggregatedFinancials = {
            grossRevenue: 0,
            platformCharges: 0,
            gstAmount: 0,
            operationalCost: 0,
            employeeIncentive: 0,
            approvedExpenses: 0,
            netProfit: 0,
            profitMarginPercent: 0
        };

        // Batch fetch existing results to prevent N+1 queries during normal page loads
        const existingResults = !forceRecalculate 
            ? await HrmsKpiResult.find({ employeeId, kpiId: { $in: kpis.map(k => k._id) }, period }).lean()
            : [];
        const resultMap = new Map(existingResults.map(r => [r.kpiId.toString(), r]));

        for (const kpi of kpis) {
            let resultDoc = resultMap.get(kpi._id.toString()) || null;
            
            if (!resultDoc || forceRecalculate) {
                // Collect dynamic metrics
                const metrics = await this.collectEmployeeMetrics(employeeId, startDate, endDate, kpi.target, kpi.ruleConfig);
                metrics.ACHIEVED = this.resolveAchievedValue(kpi.metricKey, metrics);

                // Evaluate score using dynamic formula expression or standard target percentage
                let achieved = metrics.ACHIEVED;
                let scorePercentage = 0;

                if (kpi.formulaExpression && kpi.formulaExpression.trim() !== '') {
                    scorePercentage = this.evaluateSecureFormula(kpi.formulaExpression, metrics);
                } else if (kpi.targetType === 'Percentage') {
                    scorePercentage = Math.min(100, achieved);
                } else if (kpi.target > 0) {
                    scorePercentage = Math.min(100, (achieved / kpi.target) * 100);
                }

                scorePercentage = Math.max(0, Math.min(100, Number(scorePercentage.toFixed(2))));
                const weightedScore = Number(((scorePercentage * kpi.weightage) / 100).toFixed(2));
                const perfLevel = this.resolvePerformanceLevel(scorePercentage, kpi);

                // Build historical snapshot without overwriting
                const snapshot = {
                    snapshotDate: new Date(),
                    snapshotType: kpi.frequency || 'Monthly',
                    achievedValue: achieved,
                    scorePercentage,
                    weightedScore
                };

                const updateData = {
                    achievedValue: achieved,
                    targetValue: kpi.target,
                    scorePercentage,
                    weightedScore,
                    rawMetrics: metrics,
                    financialBreakdown: metrics.financialBreakdown,
                    performanceLevel: {
                        levelName: perfLevel.levelName,
                        color: perfLevel.color,
                        icon: perfLevel.icon,
                        description: perfLevel.description
                    },
                    $push: { historicalSnapshots: snapshot },
                    calculatedAt: new Date()
                };

                resultDoc = await HrmsKpiResult.findOneAndUpdate(
                    { employeeId, kpiId: kpi._id, period },
                    { $set: {
                        achievedValue: achieved,
                        targetValue: kpi.target,
                        scorePercentage,
                        weightedScore,
                        rawMetrics: metrics,
                        financialBreakdown: metrics.financialBreakdown,
                        performanceLevel: updateData.performanceLevel,
                        calculatedAt: new Date()
                    }, $push: { historicalSnapshots: snapshot } },
                    { upsert: true, new: true }
                ).lean();

                aggregatedFinancials = metrics.financialBreakdown;
            } else {
                if (resultDoc.financialBreakdown) {
                    aggregatedFinancials = resultDoc.financialBreakdown;
                }
            }

            totalWeightage += kpi.weightage;
            finalScore += resultDoc.weightedScore;
            results.push({
                kpi,
                result: resultDoc
            });
        }

        const normalizedScore = totalWeightage > 0 ? Number(((finalScore / totalWeightage) * 100).toFixed(2)) : 0;
        const overallLevel = this.resolvePerformanceLevel(normalizedScore, {});

        return {
            period,
            employeeId,
            employeeDetails: {
                name: employee.adminId?.name || employee.employeeId || 'Employee',
                designation: employee.designation,
                department: employee.department,
                zone: employee.zone || 'Central'
            },
            totalWeightage,
            finalScore: normalizedScore,
            performanceLevel: overallLevel,
            financialBreakdown: aggregatedFinancials,
            results
        };
    }

    /**
     * Evaluate Team Performance (Manager Dashboard)
     */
    static async evaluateTeamPerformance(managerId, periodStr, forceRecalculate = false) {
        const team = await HrmsEmployee.find({ managerId, status: 'Active' })
            .select('_id adminId employeeId designation department zone hrmsRole')
            .populate('adminId', 'name email profileImage')
            .lean();
        
        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();
        
        let teamTotalScore = 0;
        let count = 0;
        let aggregatedFinancials = { grossRevenue: 0, netProfit: 0, approvedExpenses: 0, operationalCost: 0 };

        const teamMembersPerformance = await this.mapConcurrent(team, 15, async (member) => {
            const perf = await this.evaluateEmployeePerformance(member, periodStr, forceRecalculate, allActiveKpis);
            return { member, performance: perf };
        });

        for (const item of teamMembersPerformance) {
            teamTotalScore += item.performance.finalScore;
            count++;
            if (item.performance.financialBreakdown) {
                aggregatedFinancials.grossRevenue += Number(item.performance.financialBreakdown.grossRevenue) || 0;
                aggregatedFinancials.netProfit += Number(item.performance.financialBreakdown.netProfit) || 0;
                aggregatedFinancials.approvedExpenses += Number(item.performance.financialBreakdown.approvedExpenses) || 0;
                aggregatedFinancials.operationalCost += Number(item.performance.financialBreakdown.operationalCost) || 0;
            }
        }

        // Sort by finalScore descending for rankings
        teamMembersPerformance.sort((a, b) => b.performance.finalScore - a.performance.finalScore);
        
        const averageTeamScore = count > 0 ? Number((teamTotalScore / count).toFixed(2)) : 0;
        const teamLevel = this.resolvePerformanceLevel(averageTeamScore, {});

        return {
            period: periodStr || this.getPeriodDates().period,
            teamSize: count,
            averageTeamScore,
            performanceLevel: teamLevel,
            topPerformer: teamMembersPerformance[0] || null,
            lowestPerformer: teamMembersPerformance[count - 1] || null,
            financialBreakdown: aggregatedFinancials,
            teamMembersPerformance
        };
    }

    /**
     * Evaluate Department Performance (ECS Admin / Analytics)
     */
    static async evaluateDepartmentPerformance(departmentName, periodStr, forceRecalculate = false) {
        const query = { status: 'Active' };
        if (departmentName && departmentName !== 'All') query.department = departmentName;

        const employees = await HrmsEmployee.find(query).select('_id designation department zone hrmsRole').lean();
        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();

        const performances = await this.mapConcurrent(employees, 15, (emp) => 
            this.evaluateEmployeePerformance(emp, periodStr, forceRecalculate, allActiveKpis)
        );

        let totalScore = 0;
        let totalRevenue = 0;
        let totalProfit = 0;

        for (const perf of performances) {
            totalScore += perf.finalScore;
            if (perf.financialBreakdown) {
                totalRevenue += perf.financialBreakdown.grossRevenue || 0;
                totalProfit += perf.financialBreakdown.netProfit || 0;
            }
        }

        const count = performances.length;
        const avgScore = count > 0 ? Number((totalScore / count).toFixed(2)) : 0;
        return {
            department: departmentName || 'All',
            employeeCount: count,
            averageScore: avgScore,
            totalRevenue,
            totalProfit,
            performanceLevel: this.resolvePerformanceLevel(avgScore, {})
        };
    }

    /**
     * Evaluate Zone Performance (ECS Admin / Analytics)
     */
    static async evaluateZonePerformance(zoneName, periodStr, forceRecalculate = false) {
        const query = { status: 'Active' };
        if (zoneName && zoneName !== 'All') query.zone = zoneName;

        const employees = await HrmsEmployee.find(query).select('_id designation department zone hrmsRole').lean();
        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();

        const performances = await this.mapConcurrent(employees, 15, (emp) => 
            this.evaluateEmployeePerformance(emp, periodStr, forceRecalculate, allActiveKpis)
        );

        let totalScore = 0;
        let totalRevenue = 0;
        let totalProfit = 0;

        for (const perf of performances) {
            totalScore += perf.finalScore;
            if (perf.financialBreakdown) {
                totalRevenue += perf.financialBreakdown.grossRevenue || 0;
                totalProfit += perf.financialBreakdown.netProfit || 0;
            }
        }

        const count = performances.length;
        const avgScore = count > 0 ? Number((totalScore / count).toFixed(2)) : 0;
        return {
            zone: zoneName || 'All',
            employeeCount: count,
            averageScore: avgScore,
            totalRevenue,
            totalProfit,
            performanceLevel: this.resolvePerformanceLevel(avgScore, {})
        };
    }

    /**
     * Evaluate Overall Company Performance (ECS Admin Dashboard)
     */
    static async evaluateCompanyPerformance(periodStr, forceRecalculate = false) {
        const employees = await HrmsEmployee.find({ status: 'Active' })
            .select('_id adminId employeeId designation department zone hrmsRole')
            .populate('adminId', 'name email profileImage')
            .lean();

        const allActiveKpis = await HrmsKpi.find({ isActive: true }).populate('categoryId').lean();

        let totalScore = 0;
        let count = 0;
        let companyFinancials = {
            grossRevenue: 0,
            platformCharges: 0,
            gstAmount: 0,
            operationalCost: 0,
            employeeIncentive: 0,
            approvedExpenses: 0,
            netProfit: 0
        };

        // Department and Zone aggregations
        const deptMap = {};
        const zoneMap = {};

        const allPerformances = await this.mapConcurrent(employees, 15, async (emp) => {
            const perf = await this.evaluateEmployeePerformance(emp, periodStr, forceRecalculate, allActiveKpis);
            return { employee: emp, performance: perf };
        });

        for (const item of allPerformances) {
            const { employee: emp, performance: perf } = item;
            totalScore += perf.finalScore;
            count++;

            const dept = emp.department || 'General';
            const zone = emp.zone || 'Central';

            if (!deptMap[dept]) deptMap[dept] = { score: 0, count: 0, rev: 0, profit: 0 };
            deptMap[dept].score += perf.finalScore;
            deptMap[dept].count += 1;

            if (!zoneMap[zone]) zoneMap[zone] = { score: 0, count: 0, rev: 0, profit: 0 };
            zoneMap[zone].score += perf.finalScore;
            zoneMap[zone].count += 1;

            if (perf.financialBreakdown) {
                companyFinancials.grossRevenue += perf.financialBreakdown.grossRevenue || 0;
                companyFinancials.platformCharges += perf.financialBreakdown.platformCharges || 0;
                companyFinancials.gstAmount += perf.financialBreakdown.gstAmount || 0;
                companyFinancials.operationalCost += perf.financialBreakdown.operationalCost || 0;
                companyFinancials.employeeIncentive += perf.financialBreakdown.employeeIncentive || 0;
                companyFinancials.approvedExpenses += perf.financialBreakdown.approvedExpenses || 0;
                companyFinancials.netProfit += perf.financialBreakdown.netProfit || 0;

                deptMap[dept].rev += perf.financialBreakdown.grossRevenue || 0;
                deptMap[dept].profit += perf.financialBreakdown.netProfit || 0;
                zoneMap[zone].rev += perf.financialBreakdown.grossRevenue || 0;
                zoneMap[zone].profit += perf.financialBreakdown.netProfit || 0;
            }
        }

        allPerformances.sort((a, b) => b.performance.finalScore - a.performance.finalScore);
        const avgScore = count > 0 ? Number((totalScore / count).toFixed(2)) : 0;

        const departmentList = Object.keys(deptMap).map(name => ({
            name,
            count: deptMap[name].count,
            averageScore: Number((deptMap[name].score / deptMap[name].count).toFixed(2)),
            totalRevenue: deptMap[name].rev,
            totalProfit: deptMap[name].profit,
            performanceLevel: this.resolvePerformanceLevel(deptMap[name].score / deptMap[name].count, {})
        }));

        const zoneList = Object.keys(zoneMap).map(name => ({
            name,
            count: zoneMap[name].count,
            averageScore: Number((zoneMap[name].score / zoneMap[name].count).toFixed(2)),
            totalRevenue: zoneMap[name].rev,
            totalProfit: zoneMap[name].profit,
            performanceLevel: this.resolvePerformanceLevel(zoneMap[name].score / zoneMap[name].count, {})
        }));

        return {
            period: periodStr || this.getPeriodDates().period,
            totalEmployees: count,
            companyAverageScore: avgScore,
            performanceLevel: this.resolvePerformanceLevel(avgScore, {}),
            financialBreakdown: companyFinancials,
            topPerformers: allPerformances.slice(0, 5),
            bottomPerformers: allPerformances.slice(-5).reverse(),
            departmentPerformance: departmentList,
            zonePerformance: zoneList,
            allPerformances
        };
    }
}

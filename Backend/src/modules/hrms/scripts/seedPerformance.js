import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Import models
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsKpi } from '../models/kpi.model.js';
import { HrmsKpiResult } from '../models/kpiResult.model.js';

const seedPerformance = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const period = '2026-08';
        console.log(`Seeding performance data for period: ${period}`);

        // Get all employees
        const employees = await HrmsEmployee.find({ status: 'Active' });
        console.log(`Found ${employees.length} active employees`);

        // Get all active KPIs
        const allKpis = await HrmsKpi.find({ isActive: true });
        console.log(`Found ${allKpis.length} active KPIs`);

        for (const emp of employees) {
            // Find applicable KPIs for this employee
            const applicableKpis = allKpis.filter(k => 
                (k.department === 'All' || k.department === emp.department) &&
                (k.role === 'All' || k.role === emp.hrmsRole)
            );

            for (const kpi of applicableKpis) {
                // Generate a random score between 70 and 85
                const scorePercentage = Math.floor(Math.random() * 16) + 70; 
                const achievedValue = kpi.target > 0 ? (scorePercentage / 100) * kpi.target : 75;
                const weightedScore = Number(((scorePercentage * kpi.weightage) / 100).toFixed(2));

                const performanceLevel = {
                    levelName: 'Good',
                    color: '#3b82f6',
                    icon: 'Award',
                    description: 'Meets and often exceeds targets.'
                };

                const updateData = {
                    achievedValue,
                    targetValue: kpi.target,
                    scorePercentage,
                    weightedScore,
                    performanceLevel,
                    financialBreakdown: {
                        grossRevenue: 50000 + Math.random() * 20000,
                        platformCharges: 5000,
                        gstAmount: 2500,
                        operationalCost: 10000,
                        employeeIncentive: 2000,
                        approvedExpenses: 5000,
                        netProfit: 25500,
                        profitMarginPercent: 51
                    },
                    calculatedAt: new Date()
                };

                await HrmsKpiResult.findOneAndUpdate(
                    { employeeId: emp._id, kpiId: kpi._id, period },
                    { 
                        $set: updateData,
                        $push: {
                            historicalSnapshots: {
                                snapshotDate: new Date(),
                                snapshotType: kpi.frequency || 'Monthly',
                                achievedValue,
                                scorePercentage,
                                weightedScore
                            }
                        }
                    },
                    { upsert: true, new: true }
                );
            }
            console.log(`Seeded KPI results for employee: ${emp.employeeId || emp._id}`);
        }

        console.log('Successfully seeded performance data to ~75% for all employees!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding performance data:', error);
        process.exit(1);
    }
};

seedPerformance();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Import Models
import { HrmsEmployee } from './src/modules/hrms/models/employee.model.js';
import { HrmsKpi } from './src/modules/hrms/models/kpi.model.js';
import { HrmsKpiCategory } from './src/modules/hrms/models/kpiCategory.model.js';
import { HrmsKpiResult } from './src/modules/hrms/models/kpiResult.model.js';
import { HrmsDailyReport } from './src/modules/hrms/models/dailyReport.model.js';
import { FoodRestaurant } from './src/modules/food/restaurant/models/restaurant.model.js';

// Configuration
const MONTHS_TO_SEED = 3;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/itzo';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate historical periods (e.g. '2026-06', '2026-05', '2026-04')
const getHistoricalPeriods = (monthsCount) => {
    const periods = [];
    const now = new Date();
    for (let i = 1; i <= monthsCount; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return periods;
};

// Generate an array of realistic dates (excluding weekends mostly) for Daily Reports
const getHistoricalDates = (monthsCount) => {
    const dates = [];
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0); // End of last month

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) continue; 
        if (d.getDay() === 6 && Math.random() > 0.3) continue; 
        if (Math.random() < 0.1) continue;
        dates.push(new Date(d));
    }
    return dates;
};

// Seed baseline KPIs if none exist
const ensureKpisExist = async () => {
    let salesCat = await HrmsKpiCategory.findOne({ name: 'Sales & Growth' });
    if (!salesCat) salesCat = await HrmsKpiCategory.create({ name: 'Sales & Growth', description: 'Metrics related to revenue and onboarding' });

    let opsCat = await HrmsKpiCategory.findOne({ name: 'Operations' });
    if (!opsCat) opsCat = await HrmsKpiCategory.create({ name: 'Operations', description: 'Metrics related to active status and retention' });

    let hrCat = await HrmsKpiCategory.findOne({ name: 'Attendance & Discipline' });
    if (!hrCat) hrCat = await HrmsKpiCategory.create({ name: 'Attendance & Discipline', description: 'Metrics related to attendance, leaves, and daily reports' });

    const kpisToSeed = [
        { metricKey: 'REST_ONBOARDED_COUNT', name: 'Restaurants Onboarded', categoryId: salesCat._id, target: 15, targetType: 'Numeric', weightage: 30, department: 'All', role: 'All' },
        { metricKey: 'REVENUE_GENERATED', name: 'Revenue Generated', categoryId: salesCat._id, target: 500000, targetType: 'Currency', weightage: 30, department: 'All', role: 'All' },
        { metricKey: 'ACTIVE_RESTAURANTS', name: 'Active Restaurants', categoryId: opsCat._id, target: 40, targetType: 'Numeric', weightage: 20, department: 'All', role: 'All' },
        { metricKey: 'ATTENDANCE_SCORE', name: 'Attendance Score', categoryId: hrCat._id, target: 95, targetType: 'Percentage', weightage: 20, department: 'All', role: 'All' }
    ];

    for (const k of kpisToSeed) {
        await HrmsKpi.findOneAndUpdate({ metricKey: k.metricKey }, { $set: k }, { upsert: true, new: true });
    }
};

const seedData = async () => {
    await connectDB();
    console.log('🚀 Starting Data Seeding for BI Dashboard...');

    await ensureKpisExist();
    const kpis = await HrmsKpi.find({ isActive: true });
    console.log(`✅ Loaded ${kpis.length} KPIs.`);

    const employees = await HrmsEmployee.find({ status: 'Active' });
    console.log(`✅ Loaded ${employees.length} Active Employees.`);

    const restaurants = await FoodRestaurant.find({});
    console.log(`✅ Loaded ${restaurants.length} Restaurants.`);
    
    // Fast Bulk Linking of Restaurants
    const shuffledRestaurants = [...restaurants].sort(() => 0.5 - Math.random());
    const restBulkOps = [];
    let restIndex = 0;
    for (const emp of employees) {
        const numToAssign = getRandomInt(1, 3);
        for (let i = 0; i < numToAssign; i++) {
            if (restIndex >= shuffledRestaurants.length) break;
            const r = shuffledRestaurants[restIndex++];
            if (!r.onboardedBy) {
                restBulkOps.push({
                    updateOne: {
                        filter: { _id: r._id },
                        update: { $set: { onboardedBy: emp._id, assignedTo: emp._id } }
                    }
                });
            }
        }
    }
    if (restBulkOps.length > 0) {
        await FoodRestaurant.bulkWrite(restBulkOps, { ordered: false });
        console.log(`✅ Linked ${restBulkOps.length} restaurants to employees.`);
    } else {
        console.log(`✅ No new restaurants to link.`);
    }

    // Generate Historical KPI Results using bulkWrite for Speed
    const periods = getHistoricalPeriods(MONTHS_TO_SEED);
    console.log(`📅 Generating KPI Results for periods: ${periods.join(', ')}`);
    
    const kpiBulkOps = [];
    for (const emp of employees) {
        for (const period of periods) {
            for (const kpi of kpis) {
                const rand = Math.random();
                let scorePercentage;
                if (rand > 0.8) scorePercentage = getRandomInt(90, 110); 
                else if (rand > 0.4) scorePercentage = getRandomInt(75, 89); 
                else if (rand > 0.15) scorePercentage = getRandomInt(60, 74); 
                else if (rand > 0.05) scorePercentage = getRandomInt(40, 59); 
                else scorePercentage = getRandomInt(10, 39); 

                let levelName = 'Good', color = '#3b82f6', icon = 'Award';
                if (scorePercentage >= 90) { levelName = 'Excellent'; color = '#10b981'; icon = 'Trophy'; }
                else if (scorePercentage >= 75) { levelName = 'Good'; color = '#3b82f6'; icon = 'Award'; }
                else if (scorePercentage >= 60) { levelName = 'Average'; color = '#f59e0b'; icon = 'TrendingUp'; }
                else if (scorePercentage >= 40) { levelName = 'Needs Improvement'; color = '#f97316'; icon = 'AlertCircle'; }
                else { levelName = 'Poor'; color = '#ef4444'; icon = 'XCircle'; }

                const achievedValue = Number(((scorePercentage / 100) * kpi.target).toFixed(2));
                const weightedScore = Number(((scorePercentage / 100) * kpi.weightage).toFixed(2));

                const resultDoc = {
                    achievedValue,
                    targetValue: kpi.target,
                    scorePercentage,
                    weightedScore,
                    performanceLevel: { levelName, color, icon, description: `Scored ${scorePercentage}% against target.` },
                    financialBreakdown: kpi.targetType === 'Currency' ? { grossRevenue: achievedValue, netProfit: achievedValue * 0.2 } : {},
                    rawMetrics: { baseValue: achievedValue, notes: 'Generated by BI Seeder' },
                    historicalSnapshots: [{ snapshotType: 'Monthly', achievedValue, scorePercentage, weightedScore }]
                };

                kpiBulkOps.push({
                    updateOne: {
                        filter: { employeeId: emp._id, kpiId: kpi._id, period },
                        update: { $set: resultDoc },
                        upsert: true
                    }
                });
            }
        }
    }

    try {
        if (kpiBulkOps.length > 0) {
            await HrmsKpiResult.bulkWrite(kpiBulkOps, { ordered: false });
            console.log(`✅ Bulk Generated/Updated ${kpiBulkOps.length} KPI Results.`);
        }
    } catch (e) {
        console.error('Error during KPI bulkWrite:', e.message);
    }

    // Generate Daily Reports using bulkWrite
    const reportDates = getHistoricalDates(MONTHS_TO_SEED);
    console.log(`📅 Generating Daily Reports for ${reportDates.length} working days.`);
    
    const reportBulkOps = [];
    for (const emp of employees) {
        for (const date of reportDates) {
            const reportDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const isField = emp.employeeType === 'Field';
            const metrics = isField ? {
                restaurantsVisited: getRandomInt(2, 8),
                meetingsConducted: getRandomInt(1, 4),
                callsMade: getRandomInt(10, 30),
                leadsGenerated: getRandomInt(0, 5),
                ordersCompleted: getRandomInt(5, 20)
            } : {
                restaurantsVisited: 0,
                meetingsConducted: getRandomInt(1, 3),
                callsMade: getRandomInt(5, 15),
                leadsGenerated: 0,
                ordersCompleted: 0
            };

            const reportDoc = {
                tasks: [
                    { title: isField ? 'Market Visit' : 'Operational Tasks', category: 'General', status: 'Completed' },
                    { title: 'Follow-ups', category: 'General', status: 'Completed' }
                ],
                workSummary: `Completed scheduled tasks and follow-ups. ${isField ? 'Visited key locations.' : 'Managed daily operations.'}`,
                metrics,
                travelSummary: isField ? { distanceKm: getRandomInt(10, 50), vehicleUsed: 'Two-Wheeler', travelCost: getRandomInt(50, 200) } : {},
                problemsFaced: Math.random() > 0.8 ? 'Minor delays in coordination.' : 'None',
                achievements: Math.random() > 0.8 ? 'Closed a critical issue.' : 'None',
                tomorrowPlan: 'Continue pending follow-ups and schedule new meetings.',
                status: 'Approved',
                managerId: emp.managerId || null
            };

            reportBulkOps.push({
                updateOne: {
                    filter: { employeeId: emp._id, reportDate },
                    update: { $set: reportDoc },
                    upsert: true
                }
            });
        }
    }

    try {
        if (reportBulkOps.length > 0) {
            // Process in chunks to avoid Mongo BSON payload limit (16MB)
            const chunkSize = 1000;
            for (let i = 0; i < reportBulkOps.length; i += chunkSize) {
                const chunk = reportBulkOps.slice(i, i + chunkSize);
                await HrmsDailyReport.bulkWrite(chunk, { ordered: false });
                console.log(`... Inserted ${i + chunk.length} / ${reportBulkOps.length} Daily Reports ...`);
            }
            console.log(`✅ Bulk Generated/Updated all ${reportBulkOps.length} Daily Reports.`);
        }
    } catch (e) {
        console.error('Error during Daily Reports bulkWrite:', e.message);
    }

    console.log('🎉 Seeding Complete! The BI Dashboard is now ready with realistic test data.');
    process.exit(0);
};

seedData();

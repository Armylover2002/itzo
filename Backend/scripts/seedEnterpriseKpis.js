import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { HrmsKpiCategory } from '../src/modules/hrms/models/kpiCategory.model.js';
import { HrmsKpi } from '../src/modules/hrms/models/kpi.model.js';

const defaultLevels = [
    { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets and expectations.' },
    { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
    { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
    { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus and coaching.' },
    { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
];

async function seedEnterpriseKpis() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/itzofood';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for Enterprise KPI Seeding...');

        // 1. Seed Categories
        const categoriesData = [
            { name: 'Restaurant Onboarding', description: 'Metrics evaluating new restaurant acquisition and onboarding speed.' },
            { name: 'Restaurant Activity', description: 'Metrics measuring active restaurants, menu availability, and order volumes.' },
            { name: 'Orders & Volume', description: 'Daily and monthly delivered order counts across assigned restaurants.' },
            { name: 'Revenue & Finance', description: 'Gross revenue, platform charges, GST, incentives, operational cost, and net profit.' },
            { name: 'Attendance & Discipline', description: 'Employee attendance percentage, leave ratio, short hours, and punctuality.' },
            { name: 'Daily Reports & Compliance', description: 'Timeliness and consistency in submitting daily work reports.' }
        ];

        const categoryMap = {};
        for (const cat of categoriesData) {
            const created = await HrmsKpiCategory.findOneAndUpdate(
                { name: cat.name },
                { $set: cat },
                { upsert: true, new: true }
            );
            categoryMap[cat.name] = created._id;
        }
        console.log('Seeded KPI Categories:', Object.keys(categoryMap));

        // 2. Seed Dynamic KPIs
        const kpisData = [
            {
                name: 'Restaurant Onboarding Achievement',
                metricKey: 'REST_ONBOARDED_COUNT',
                categoryId: categoryMap['Restaurant Onboarding'],
                description: 'Measures total approved restaurants onboarded against the monthly target.',
                weightage: 20,
                target: 100,
                targetType: 'Numeric',
                frequency: 'Monthly',
                formulaExpression: '(RESTAURANTS_ONBOARDED / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['Sales', 'Operations', 'All']
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Active Restaurants Efficiency',
                metricKey: 'REST_ACTIVE_COUNT',
                categoryId: categoryMap['Restaurant Activity'],
                description: 'Measures active restaurants generating orders and maintaining open menus.',
                weightage: 15,
                target: 80,
                targetType: 'Numeric',
                frequency: 'Monthly',
                formulaExpression: '(ACTIVE_RESTAURANTS / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All'],
                    minOrdersThreshold: 1,
                    activeRestaurantRules: {
                        requireApproved: true,
                        requireMenuAvailable: true,
                        requireAcceptingOrders: true,
                        requireNotSuspended: true,
                        minOrders: 1
                    }
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Monthly Delivered Orders Volume',
                metricKey: 'ORDERS_GENERATED',
                categoryId: categoryMap['Orders & Volume'],
                description: 'Total delivered orders generated from assigned restaurants.',
                weightage: 20,
                target: 1000,
                targetType: 'Numeric',
                frequency: 'Monthly',
                formulaExpression: '(MONTHLY_ORDERS / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All'],
                    minMonthlyOrders: 10
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Gross Revenue Generation',
                metricKey: 'REVENUE_GENERATED',
                categoryId: categoryMap['Revenue & Finance'],
                description: 'Total gross revenue generated across assigned restaurants.',
                weightage: 20,
                target: 100000,
                targetType: 'Currency',
                frequency: 'Monthly',
                formulaExpression: '(GROSS_REVENUE / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All']
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Net Profit Margin Contribution',
                metricKey: 'FINANCE_NET_PROFIT',
                categoryId: categoryMap['Revenue & Finance'],
                description: 'Net profit contribution after deducting incentives, GST, and operational expenses.',
                weightage: 15,
                target: 20000,
                targetType: 'Currency',
                frequency: 'Monthly',
                formulaExpression: '(NET_PROFIT / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All']
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Attendance & Punctuality',
                metricKey: 'ATTENDANCE_SCORE',
                categoryId: categoryMap['Attendance & Discipline'],
                description: 'Monthly attendance percentage adjusted for leaves and short hours.',
                weightage: 5,
                target: 100,
                targetType: 'Percentage',
                frequency: 'Monthly',
                formulaExpression: 'ATTENDANCE_PERCENTAGE',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All']
                },
                performanceLevels: defaultLevels
            },
            {
                name: 'Daily Report Submission Compliance',
                metricKey: 'DAILY_REPORT_SCORE',
                categoryId: categoryMap['Daily Reports & Compliance'],
                description: 'Consistency and timeliness in submitting daily work reports.',
                weightage: 5,
                target: 30,
                targetType: 'Numeric',
                frequency: 'Monthly',
                formulaExpression: '(ACHIEVED / TARGET) * 100',
                ruleConfig: {
                    appliesToRole: ['All'],
                    appliesToDepartment: ['All']
                },
                performanceLevels: defaultLevels
            }
        ];

        for (const kpi of kpisData) {
            await HrmsKpi.findOneAndUpdate(
                { metricKey: kpi.metricKey },
                { $set: kpi },
                { upsert: true, new: true }
            );
        }
        console.log('Successfully seeded 7 Enterprise KPIs with dynamic formulas and performance levels.');

        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    } catch (error) {
        console.error('Error seeding Enterprise KPIs:', error);
        process.exit(1);
    }
}

seedEnterpriseKpis();

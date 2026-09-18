/**
 * Migration Script: Convert individual HrmsExpense records into HrmsMonthlyExpense batches.
 *
 * Usage:
 *   node --experimental-modules migrateExpensesToMonthly.js          # Dry-run (default)
 *   node --experimental-modules migrateExpensesToMonthly.js --execute # Actually perform migration
 *
 * This script:
 *   1. Fetches all existing HrmsExpense records
 *   2. Groups them by employeeId + month + year
 *   3. Creates HrmsMonthlyExpense batch documents for each group
 *   4. Skips groups that already have a HrmsMonthlyExpense record (idempotent)
 *   5. Marks migrated batches with isLegacy = true
 *
 * Status derivation for batches:
 *   - All entries Approved → Approved
 *   - All entries Rejected → Rejected
 *   - Any entry Reimbursed → Reimbursed
 *   - Mixed or all Pending → Pending
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables — adjust path to your .env location
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Import models
import { HrmsExpense, HrmsMonthlyExpense } from '../models/expense.model.js';

const EXECUTE = process.argv.includes('--execute');

async function migrate() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI or MONGO_URI not found in environment variables');
        process.exit(1);
    }

    console.log(`\n🔧 Monthly Expense Migration Script`);
    console.log(`   Mode: ${EXECUTE ? '🚀 EXECUTE (will write to DB)' : '👀 DRY-RUN (read-only)'}`);
    console.log(`   Database: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all individual expenses
    const allExpenses = await HrmsExpense.find({}).sort({ visitDate: 1 }).lean();
    console.log(`📋 Found ${allExpenses.length} individual expense records\n`);

    if (allExpenses.length === 0) {
        console.log('ℹ️  No expenses to migrate. Exiting.');
        await mongoose.disconnect();
        return;
    }

    // Group by employeeId + month + year
    const groups = {};
    for (const expense of allExpenses) {
        const empId = String(expense.employeeId);
        const date = new Date(expense.visitDate);
        const month = date.getMonth() + 1; // 1-indexed
        const year = date.getFullYear();
        const key = `${empId}_${year}_${month}`;

        if (!groups[key]) {
            groups[key] = {
                employeeId: expense.employeeId,
                month,
                year,
                entries: [],
                statuses: []
            };
        }
        groups[key].entries.push(expense);
        groups[key].statuses.push(expense.status);
    }

    const groupKeys = Object.keys(groups);
    console.log(`📊 Grouped into ${groupKeys.length} monthly batches\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const key of groupKeys) {
        const group = groups[key];

        // Check if batch already exists (idempotent)
        const existing = await HrmsMonthlyExpense.findOne({
            employeeId: group.employeeId,
            month: group.month,
            year: group.year
        });

        if (existing) {
            console.log(`   ⏭️  SKIP: Employee ${String(group.employeeId).slice(-6)} | ${group.month}/${group.year} — batch already exists`);
            skipped++;
            continue;
        }

        // Derive batch status from constituent expenses
        const statuses = group.statuses;
        let batchStatus = 'Pending';
        if (statuses.every(s => s === 'Approved')) batchStatus = 'Approved';
        else if (statuses.every(s => s === 'Rejected')) batchStatus = 'Rejected';
        else if (statuses.some(s => s === 'Reimbursed')) batchStatus = 'Reimbursed';

        // Find approval metadata from first approved expense
        const firstApproved = group.entries.find(e => e.status === 'Approved');

        // Build entries
        const entries = group.entries.map(e => ({
            visitDate: e.visitDate,
            purpose: e.purpose || 'Legacy expense',
            travelDistanceKm: Math.max(0, Number(e.travelDistanceKm) || 0),
            travelCost: Math.max(0, Number(e.travelCost) || 0),
            hotelCost: Math.max(0, Number(e.hotelCost) || 0),
            foodCost: Math.max(0, Number(e.foodCost) || 0),
            otherExpenses: Math.max(0, Number(e.otherExpenses) || 0),
            remarks: e.remarks || '',
            attachments: e.attachments || [],
            entryTotal: (Number(e.travelCost) || 0) + (Number(e.hotelCost) || 0) + (Number(e.foodCost) || 0) + (Number(e.otherExpenses) || 0)
        }));

        const totalAmount = entries.reduce((sum, e) => sum + e.entryTotal, 0);

        const batchData = {
            employeeId: group.employeeId,
            month: group.month,
            year: group.year,
            entries,
            totalAmount,
            status: batchStatus,
            isLegacy: true,
            submittedAt: group.entries[0]?.createdAt || new Date(),
            ...(batchStatus === 'Approved' && firstApproved ? {
                approvedBy: firstApproved.approvedBy,
                approvedAt: firstApproved.approvedAt,
                approvedAmount: totalAmount
            } : {}),
            ...(batchStatus === 'Rejected' && group.entries.find(e => e.rejectionReason) ? {
                rejectionReason: group.entries.find(e => e.rejectionReason).rejectionReason
            } : {})
        };

        console.log(`   ${EXECUTE ? '✅' : '📝'} ${EXECUTE ? 'CREATE' : 'WOULD CREATE'}: Employee ...${String(group.employeeId).slice(-6)} | ${group.month}/${group.year} | ${entries.length} entries | ₹${totalAmount} | Status: ${batchStatus}`);

        if (EXECUTE) {
            try {
                await HrmsMonthlyExpense.create(batchData);
                created++;
            } catch (err) {
                console.error(`   ❌ ERROR creating batch: ${err.message}`);
                errors++;
            }
        } else {
            created++;
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📈 Migration Summary:`);
    console.log(`   Total groups:  ${groupKeys.length}`);
    console.log(`   ${EXECUTE ? 'Created' : 'Would create'}: ${created}`);
    console.log(`   Skipped:       ${skipped}`);
    if (errors > 0) console.log(`   Errors:        ${errors}`);
    console.log(`${'─'.repeat(60)}\n`);

    if (!EXECUTE) {
        console.log('💡 This was a DRY-RUN. To actually migrate, run with --execute flag.\n');
    }

    await mongoose.disconnect();
    console.log('✅ Done. Disconnected from MongoDB.\n');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});

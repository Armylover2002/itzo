/**
 * Report Absent Cron Job
 * 
 * Runs daily (recommended: 11 PM IST via setInterval in server.js).
 * For each active employee, checks if daily reports are missing for 2 consecutive
 * working days. If both days have no submitted report AND the employee was marked
 * Present/Half-Day, mark those days as Absent.
 * 
 * Excludes weekends (Sunday) and holidays from the consecutive day count.
 */

import { HrmsDailyReport } from '../models/dailyReport.model.js';
import { HrmsAttendance } from '../models/attendance.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsSettings } from '../models/settings.model.js';

/**
 * Get the previous N working days (excluding Sundays and holidays)
 * @param {number} count - Number of working days to look back
 * @param {Date[]} holidays - Array of holiday dates (normalized to midnight)
 * @returns {Date[]} Array of working day dates (most recent first)
 */
const getPreviousWorkingDays = (count, holidays = []) => {
    const days = [];
    const current = new Date();
    current.setUTCHours(0, 0, 0, 0);

    // Normalize holiday dates to midnight strings for easy comparison
    const holidaySet = new Set(
        holidays.map(h => {
            const d = new Date(h);
            d.setUTCHours(0, 0, 0, 0);
            return d.toISOString().split('T')[0];
        })
    );

    let daysBack = 1; // Start from yesterday
    while (days.length < count) {
        const checkDate = new Date(current);
        checkDate.setUTCDate(checkDate.getUTCDate() - daysBack);
        checkDate.setUTCHours(0, 0, 0, 0);

        const dayOfWeek = checkDate.getUTCDay(); // 0 = Sunday
        const dateStr = checkDate.toISOString().split('T')[0];

        // Skip Sundays and holidays
        if (dayOfWeek !== 0 && !holidaySet.has(dateStr)) {
            days.push(new Date(checkDate));
        }

        daysBack++;
        // Safety limit to prevent infinite loop
        if (daysBack > 30) break;
    }

    return days;
};

/**
 * Main cron function — checks all active employees and marks absent
 * for 2 consecutive unreported working days.
 */
export const runReportAbsentCheck = async () => {
    console.log('[ReportAbsentCron] Starting daily report absent check...');

    try {
        // Fetch settings for holiday calendar
        const settings = await HrmsSettings.findOne().lean();
        const holidays = settings?.holidayCalendar?.map(h => h.date) || [];

        // Get previous 2 working days
        const workingDays = getPreviousWorkingDays(2, holidays);

        if (workingDays.length < 2) {
            console.log('[ReportAbsentCron] Could not determine 2 previous working days. Skipping.');
            return { processed: 0, marked: 0 };
        }

        const [day1, day2] = workingDays; // day1 = most recent, day2 = day before
        console.log(`[ReportAbsentCron] Checking days: ${day1.toISOString().split('T')[0]} and ${day2.toISOString().split('T')[0]}`);

        // Fetch all active employees
        const activeEmployees = await HrmsEmployee.find(
            { status: 'Active' },
            { _id: 1 }
        ).lean();

        if (activeEmployees.length === 0) {
            console.log('[ReportAbsentCron] No active employees found.');
            return { processed: 0, marked: 0 };
        }

        const employeeIds = activeEmployees.map(e => e._id);

        // Bulk fetch reports for both days
        const reports = await HrmsDailyReport.find({
            employeeId: { $in: employeeIds },
            reportDate: { $in: [day1, day2] },
            status: { $in: ['Submitted', 'Under Review', 'Approved'] }
        }, { employeeId: 1, reportDate: 1 }).lean();

        // Build a set of "employeeId|date" for quick lookup
        const reportSet = new Set(
            reports.map(r => `${r.employeeId.toString()}|${r.reportDate.toISOString().split('T')[0]}`)
        );

        const day1Str = day1.toISOString().split('T')[0];
        const day2Str = day2.toISOString().split('T')[0];

        let markedCount = 0;

        for (const emp of activeEmployees) {
            const empIdStr = emp._id.toString();
            const hasDay1Report = reportSet.has(`${empIdStr}|${day1Str}`);
            const hasDay2Report = reportSet.has(`${empIdStr}|${day2Str}`);

            // Only mark absent if BOTH consecutive days have no submitted report
            if (!hasDay1Report && !hasDay2Report) {
                // Mark both days as Absent in attendance (only if they were Present or Half-Day)
                for (const day of [day1, day2]) {
                    try {
                        const attendance = await HrmsAttendance.findOne({
                            employeeId: emp._id,
                            date: day
                        });

                        if (attendance && ['Present', 'Half-Day'].includes(attendance.status)) {
                            attendance.status = 'Absent';
                            await attendance.save();
                            markedCount++;
                            console.log(`[ReportAbsentCron] Marked ${empIdStr} as Absent for ${day.toISOString().split('T')[0]}`);
                        }
                        // If no attendance record exists (employee didn't check in), they're already absent
                    } catch (err) {
                        console.error(`[ReportAbsentCron] Error updating attendance for ${empIdStr} on ${day.toISOString().split('T')[0]}:`, err.message);
                    }
                }
            }
        }

        console.log(`[ReportAbsentCron] Completed. Processed ${activeEmployees.length} employees, marked ${markedCount} attendance records as Absent.`);
        return { processed: activeEmployees.length, marked: markedCount };

    } catch (error) {
        console.error('[ReportAbsentCron] Fatal error:', error);
        return { processed: 0, marked: 0, error: error.message };
    }
};

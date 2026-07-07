/**
 * Payslip Canvas Renderer
 * ──────────────────────────────────────────────────────────────────────────────
 * Draws a professional, high-resolution payslip PNG using @napi-rs/canvas.
 *
 * Design rationale:
 *  - Stateless: each call creates its own canvas — safe for concurrent requests
 *  - Zero system deps: @napi-rs/canvas ships prebuilt Skia binaries
 *  - High-res: 1588×2246 (A4 at 2× DPI) for crisp print & screen display
 *  - Matches the existing HBS template layout pixel-for-pixel
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createCanvas } from '@napi-rs/canvas';

// ── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
    white:      '#FFFFFF',
    bgCard:     '#F8FAFC',
    bgHeader:   '#F1F5F9',
    border:     '#E2E8F0',
    textDark:   '#0F172A',
    textBody:   '#1E293B',
    textMuted:  '#475569',
    textLabel:  '#64748B',
    textLight:  '#94A3B8',
    accent:     '#F97316',  // Orange brand
    emerald:    '#10B981',  // Net pay
    divider:    '#CBD5E1',
};

const W = 1588;  // Canvas width  (A4 @ 2× → 794 * 2)
const H = 2246;  // Canvas height (A4 @ 2× → 1123 * 2)
const PAD = 80;  // Outer padding
const COL_GAP = 40;
const HALF_W = (W - PAD * 2 - COL_GAP) / 2;

// ── Drawing Primitives ───────────────────────────────────────────────────────

/** Draw a rounded rectangle (fill + optional stroke) */
const drawRoundedRect = (ctx, x, y, w, h, r, fillColor, strokeColor) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
    if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = 2; ctx.stroke(); }
};

/** Draw a horizontal line */
const drawLine = (ctx, x1, y1, x2, y2, color = COLORS.border, width = 2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
};

/** Draw text at a position */
const drawText = (ctx, text, x, y, { font = '26px sans-serif', color = COLORS.textBody, align = 'left', maxWidth } = {}) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (maxWidth) {
        ctx.fillText(String(text ?? ''), x, y, maxWidth);
    } else {
        ctx.fillText(String(text ?? ''), x, y);
    }
};

// ── Section Renderers ────────────────────────────────────────────────────────

/** Draw the header: Company name (left) + PAYSLIP badge (right) */
const drawHeader = (ctx, data) => {
    let y = PAD;

    // Company name
    drawText(ctx, data.companyName, PAD, y, { font: 'bold 48px sans-serif', color: COLORS.textDark });
    y += 56;
    drawText(ctx, data.companyAddress, PAD, y, { font: '24px sans-serif', color: COLORS.textLabel });

    // Right side: PAYSLIP title
    drawText(ctx, 'PAYSLIP', W - PAD, PAD, { font: 'bold 40px sans-serif', color: COLORS.accent, align: 'right' });
    drawText(ctx, `${data.monthName} ${data.year}`, W - PAD, PAD + 48, { font: '500 26px sans-serif', color: COLORS.textMuted, align: 'right' });

    // Status badge
    const statusColors = { Paid: '#10B981', Approved: '#3B82F6', Draft: '#64748B' };
    const badgeColor = statusColors[data.status] || '#64748B';
    const badgeText = data.status?.toUpperCase() || 'DRAFT';
    ctx.font = 'bold 20px sans-serif';
    const badgeWidth = ctx.measureText(badgeText).width + 32;
    const badgeX = W - PAD - badgeWidth;
    const badgeY = PAD + 90;
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 32, 16, badgeColor + '20');
    drawText(ctx, badgeText, badgeX + badgeWidth / 2, badgeY + 6, { font: 'bold 20px sans-serif', color: badgeColor, align: 'center' });

    y += 50;

    // Divider
    drawLine(ctx, PAD, y, W - PAD, y, COLORS.border, 4);
    return y + 40;
};

/**
 * Draw a detail card (Employee Details or Attendance & Bank Info)
 * @returns {number} y position after the card
 */
const drawDetailCard = (ctx, x, y, title, rows, width) => {
    const rowH = 40;
    const cardH = 44 + rows.length * rowH + 20;
    drawRoundedRect(ctx, x, y, width, cardH, 16, COLORS.bgCard, COLORS.border);

    // Card title
    drawText(ctx, title, x + 24, y + 16, { font: 'bold 24px sans-serif', color: COLORS.textDark });
    let ry = y + 56;

    for (const [label, value] of rows) {
        drawText(ctx, label, x + 24, ry, { font: '24px sans-serif', color: COLORS.textLabel, maxWidth: width * 0.42 });
        drawText(ctx, value, x + width * 0.44, ry, { font: '500 24px sans-serif', color: COLORS.textDark, maxWidth: width * 0.52 });
        ry += rowH;
    }

    return y + cardH;
};

/**
 * Draw a salary breakdown table (Earnings or Deductions)
 * @param {Array<[string, string]>} rows - Label-value pairs
 * @param {[string, string]} totalRow - Total label-value
 * @returns {number} y after table
 */
const drawBreakdownTable = (ctx, x, y, headerText, rows, totalRow, width) => {
    const rowH = 46;
    const headerH = 48;
    const tableH = headerH + rows.length * rowH + rowH; // +1 for total row

    // Table border
    drawRoundedRect(ctx, x, y, width, tableH, 16, COLORS.white, COLORS.border);

    // Header row
    drawRoundedRect(ctx, x + 1, y + 1, width - 2, headerH, 16, COLORS.bgHeader);
    // Fill the bottom corners of the header (they shouldn't be rounded)
    ctx.fillStyle = COLORS.bgHeader;
    ctx.fillRect(x + 1, y + headerH - 16, width - 2, 16);

    drawText(ctx, headerText, x + 24, y + 12, { font: 'bold 24px sans-serif', color: COLORS.textDark });
    drawText(ctx, 'Amount (₹)', x + width - 24, y + 12, { font: 'bold 24px sans-serif', color: COLORS.textDark, align: 'right' });

    let ry = y + headerH;

    // Data rows
    for (const [label, value] of rows) {
        drawLine(ctx, x + 1, ry, x + width - 1, ry, COLORS.border, 1);
        drawText(ctx, label, x + 24, ry + 12, { font: '24px sans-serif', color: COLORS.textMuted });
        drawText(ctx, value, x + width - 24, ry + 12, { font: '24px sans-serif', color: COLORS.textMuted, align: 'right' });
        ry += rowH;
    }

    // Total row
    drawLine(ctx, x + 1, ry, x + width - 1, ry, COLORS.border, 3);
    ctx.fillStyle = COLORS.bgCard;
    ctx.fillRect(x + 1, ry + 1, width - 2, rowH - 2);
    drawText(ctx, totalRow[0], x + 24, ry + 12, { font: 'bold 24px sans-serif', color: COLORS.textDark });
    drawText(ctx, totalRow[1], x + width - 24, ry + 12, { font: 'bold 24px sans-serif', color: COLORS.textDark, align: 'right' });

    return y + tableH;
};

/** Draw the net pay summary section */
const drawSummarySection = (ctx, y, data) => {
    const sectionH = 180;
    drawRoundedRect(ctx, PAD, y, W - PAD * 2, sectionH, 16, COLORS.bgCard, COLORS.border);

    const thirdW = (W - PAD * 2) / 3;

    // Gross Earnings
    drawText(ctx, 'Gross Earnings', PAD + thirdW * 0.5, y + 28, { font: '500 22px sans-serif', color: COLORS.textLabel, align: 'center' });
    drawText(ctx, `₹${data.grossEarnings}`, PAD + thirdW * 0.5, y + 58, { font: 'bold 34px sans-serif', color: COLORS.textDark, align: 'center' });

    // Total Deductions
    drawText(ctx, 'Total Deductions', PAD + thirdW * 1.5, y + 28, { font: '500 22px sans-serif', color: COLORS.textLabel, align: 'center' });
    drawText(ctx, `₹${data.totalDeductions}`, PAD + thirdW * 1.5, y + 58, { font: 'bold 34px sans-serif', color: COLORS.textDark, align: 'center' });

    // Net Pay (highlighted)
    drawText(ctx, 'Net Pay', PAD + thirdW * 2.5, y + 28, { font: '500 22px sans-serif', color: COLORS.textLabel, align: 'center' });
    drawText(ctx, `₹${data.netSalary}`, PAD + thirdW * 2.5, y + 58, { font: 'bold 44px sans-serif', color: COLORS.emerald, align: 'center' });

    // Amount in words
    drawText(ctx, `Amount in words: ${data.amountInWords}`, (W) / 2, y + 125, { font: '500 22px sans-serif', color: COLORS.textMuted, align: 'center' });

    return y + sectionH;
};

/** Draw signature lines */
const drawSignatures = (ctx, y) => {
    const sigY = y + 80;
    const lineW = 320;

    // Employee signature (left)
    drawLine(ctx, PAD + 80, sigY, PAD + 80 + lineW, sigY, COLORS.divider, 2);
    drawText(ctx, 'Employee Signature', PAD + 80 + lineW / 2, sigY + 16, { font: '22px sans-serif', color: COLORS.textMuted, align: 'center' });

    // Authorised signatory (right)
    drawLine(ctx, W - PAD - 80 - lineW, sigY, W - PAD - 80, sigY, COLORS.divider, 2);
    drawText(ctx, 'Authorised Signatory', W - PAD - 80 - lineW / 2, sigY + 16, { font: '22px sans-serif', color: COLORS.textMuted, align: 'center' });

    return sigY + 60;
};

/** Draw footer */
const drawFooter = (ctx, y, data) => {
    drawLine(ctx, PAD, y, W - PAD, y, COLORS.border, 2);
    drawText(ctx, `This is a system generated document. Generated By: ${data.generatedBy} on ${data.generatedDate} (v${data.payslipVersion})`, W / 2, y + 24, {
        font: '20px sans-serif',
        color: COLORS.textLight,
        align: 'center'
    });
};

// ── Main Render Function ─────────────────────────────────────────────────────

/**
 * Render a complete payslip as a high-resolution PNG buffer.
 *
 * @param {Object} data - Renderer-ready data from dataBuilder.js
 * @returns {Buffer}    - PNG image buffer
 */
export const renderPayslipImage = (data) => {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, W, H);

    // ── Header ───────────────────────────────────────────────────────────────
    let y = drawHeader(ctx, data);

    // ── Detail Cards (2-column grid) ─────────────────────────────────────────
    const cardStartY = y;
    const leftX = PAD;
    const rightX = PAD + HALF_W + COL_GAP;

    const leftCardBottom = drawDetailCard(ctx, leftX, cardStartY, 'EMPLOYEE DETAILS', [
        ['Name:', data.employeeName],
        ['Employee ID:', data.employeeId],
        ['Designation:', data.designation],
        ['Department:', data.department],
        ['Joining Date:', data.joiningDate],
    ], HALF_W);

    const rightCardBottom = drawDetailCard(ctx, rightX, cardStartY, 'ATTENDANCE & BANK INFO', [
        ['Total Working Days:', String(data.totalWorkingDays)],
        ['Present Days:', String(data.presentDays)],
        ['LOP Days:', String(data.lopDays)],
        ['Bank Name:', data.bankName],
        ['Account No:', data.accountNumber],
        ['PAN:', data.panNumber],
    ], HALF_W);

    y = Math.max(leftCardBottom, rightCardBottom) + 40;

    // ── Salary Breakdown Tables (2-column) ───────────────────────────────────
    const earningsBottom = drawBreakdownTable(ctx, leftX, y, 'Earnings', [
        ['Basic Salary', data.baseSalary],
        ['Overtime Bonus', data.overtimeBonus],
        ['Reimbursements', data.reimbursements],
        ['', ''],  // Spacer
        ['', ''],  // Spacer
    ], ['Gross Earnings', data.grossEarnings], HALF_W);

    const deductionsBottom = drawBreakdownTable(ctx, rightX, y, 'Deductions', [
        ['LOP Deduction', data.lopDeduction],
        ['Short Hours Deduction', data.shortHourDeduction],
        ['PF', '0.00'],
        ['ESI', '0.00'],
        ['Tax', '0.00'],
    ], ['Total Deductions', data.totalDeductions], HALF_W);

    y = Math.max(earningsBottom, deductionsBottom) + 40;

    // ── Net Pay Summary ──────────────────────────────────────────────────────
    y = drawSummarySection(ctx, y, data) + 20;

    // ── Signatures ───────────────────────────────────────────────────────────
    y = drawSignatures(ctx, y);

    // ── Footer ───────────────────────────────────────────────────────────────
    drawFooter(ctx, y + 40, data);

    // ── Export PNG ────────────────────────────────────────────────────────────
    return canvas.toBuffer('image/png');
};

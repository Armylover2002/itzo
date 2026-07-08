/**
 * Payslip PDF Renderer
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates a professional, enterprise-grade A4 PDF payslip using jsPDF.
 *
 * Design rationale:
 *  - Stateless: each call creates its own jsPDF instance — safe for concurrent requests
 *  - Zero system deps: jsPDF runs in pure JS/Node — no Puppeteer, Chrome, or canvas needed
 *  - Print-ready: A4 layout with proper margins, spacing, and typography
 *  - Memory efficient: generates PDF buffer directly in memory
 *  - Replaces canvasRenderer.js (which is preserved as rollback backup)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
    primary:    [249, 115, 22],   // Orange brand (#F97316)
    dark:       [15, 23, 42],     // Slate 900
    body:       [30, 41, 59],     // Slate 800
    muted:      [71, 85, 105],    // Slate 600
    label:      [100, 116, 139],  // Slate 500
    light:      [148, 163, 184],  // Slate 400
    emerald:    [16, 185, 129],   // Emerald 500
    red:        [239, 68, 68],    // Red 500
    blue:       [59, 130, 246],   // Blue 500
    bgCard:     [248, 250, 252],  // Slate 50
    bgHeader:   [241, 245, 249],  // Slate 100
    border:     [226, 232, 240],  // Slate 200
    white:      [255, 255, 255],
};

const MARGIN = 20; // mm
const PAGE_W = 210; // A4 width mm
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Draw a colored rounded rectangle */
const drawRoundedRect = (doc, x, y, w, h, r, fillColor, strokeColor) => {
    if (fillColor) {
        doc.setFillColor(...fillColor);
    }
    if (strokeColor) {
        doc.setDrawColor(...strokeColor);
        doc.setLineWidth(0.3);
    }
    doc.roundedRect(x, y, w, h, r, r, fillColor && strokeColor ? 'FD' : fillColor ? 'F' : 'S');
};

/** Draw a horizontal line */
const drawLine = (doc, x1, y1, x2, y2, color = COLORS.border, width = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
};

/** Set text style and draw */
const drawText = (doc, text, x, y, { size = 10, color = COLORS.body, style = 'normal', align = 'left', maxWidth } = {}) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', style);
    const options = { align };
    if (maxWidth) options.maxWidth = maxWidth;
    doc.text(String(text ?? ''), x, y, options);
};

// ── Section Renderers ────────────────────────────────────────────────────────

/** Draw the header: Company name + PAYSLIP badge */
const drawHeader = (doc, data) => {
    let y = MARGIN;

    // Company name
    drawText(doc, data.companyName, MARGIN, y + 5, { size: 18, color: COLORS.dark, style: 'bold' });
    y += 7;
    drawText(doc, data.companyAddress, MARGIN, y + 5, { size: 8, color: COLORS.label });

    // Right side: PAYSLIP title
    drawText(doc, 'PAYSLIP', PAGE_W - MARGIN, MARGIN + 5, { size: 16, color: COLORS.primary, style: 'bold', align: 'right' });
    drawText(doc, `${data.monthName} ${data.year}`, PAGE_W - MARGIN, MARGIN + 12, { size: 10, color: COLORS.muted, align: 'right' });

    // Status badge removed as per request

    y += 10;

    // Divider
    drawLine(doc, MARGIN, y + 5, PAGE_W - MARGIN, y + 5, COLORS.primary, 0.8);
    return y + 10;
};

/**
 * Draw a detail card with label-value pairs
 * @returns {number} y position after the card
 */
const drawDetailCard = (doc, x, y, title, rows, width) => {
    const rowH = 5.5;
    const titleH = 8;
    const cardH = titleH + rows.length * rowH + 4;

    // Card background
    drawRoundedRect(doc, x, y, width, cardH, 2, COLORS.bgCard, COLORS.border);

    // Card title
    drawText(doc, title, x + 4, y + 5.5, { size: 9, color: COLORS.dark, style: 'bold' });

    let ry = y + titleH + 2;
    for (const [label, value] of rows) {
        drawText(doc, label, x + 4, ry + 3, { size: 8, color: COLORS.label });
        drawText(doc, value, x + width * 0.44, ry + 3, { size: 8, color: COLORS.dark, style: 'bold' });
        ry += rowH;
    }

    return y + cardH;
};

/**
 * Draw a salary breakdown table using jspdf-autotable
 * @returns {number} y after table
 */
const drawBreakdownTable = (doc, x, y, headerText, rows, totalRow, width) => {
    const tableBody = rows.map(([label, value]) => [label, value]);

    autoTable(doc, {
        startY: y,
        margin: { left: x, right: PAGE_W - x - width },
        tableWidth: width,
        head: [[headerText, 'Amount (Rs.)']],
        body: tableBody,
        foot: [[totalRow[0], totalRow[1]]],
        theme: 'plain',
        styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
            textColor: COLORS.muted,
            lineColor: COLORS.border,
            lineWidth: 0.2,
            font: 'helvetica',
        },
        headStyles: {
            fillColor: COLORS.bgHeader,
            textColor: COLORS.dark,
            fontStyle: 'bold',
            fontSize: 8.5,
            lineColor: COLORS.border,
            lineWidth: 0.3,
        },
        footStyles: {
            fillColor: COLORS.bgCard,
            textColor: COLORS.dark,
            fontStyle: 'bold',
            fontSize: 9,
            lineColor: COLORS.border,
            lineWidth: 0.3,
        },
        columnStyles: {
            0: { cellWidth: width * 0.6 },
            1: { cellWidth: width * 0.4, halign: 'right' },
        },
        didParseCell: (data) => {
            // Style the amount column header
            if (data.section === 'head' && data.column.index === 1) {
                data.cell.styles.halign = 'right';
            }
        },
    });

    return (doc.lastAutoTable || doc.previousAutoTable)?.finalY || y + 40;
};

/** Draw the net pay summary section */
const drawSummarySection = (doc, y, data) => {
    const sectionH = 28;
    drawRoundedRect(doc, MARGIN, y, CONTENT_W, sectionH, 3, COLORS.bgCard, COLORS.border);

    const thirdW = CONTENT_W / 3;

    // Gross Earnings
    drawText(doc, 'Gross Earnings', MARGIN + thirdW * 0.5, y + 7, { size: 8, color: COLORS.label, align: 'center' });
    drawText(doc, `Rs.${data.grossEarnings}`, MARGIN + thirdW * 0.5, y + 13, { size: 11, color: COLORS.dark, style: 'bold', align: 'center' });

    // Total Deductions
    drawText(doc, 'Total Deductions', MARGIN + thirdW * 1.5, y + 7, { size: 8, color: COLORS.label, align: 'center' });
    drawText(doc, `Rs.${data.totalDeductions}`, MARGIN + thirdW * 1.5, y + 13, { size: 11, color: COLORS.red, style: 'bold', align: 'center' });

    // Vertical separator lines
    drawLine(doc, MARGIN + thirdW, y + 4, MARGIN + thirdW, y + sectionH - 4, COLORS.border, 0.3);
    drawLine(doc, MARGIN + thirdW * 2, y + 4, MARGIN + thirdW * 2, y + sectionH - 4, COLORS.border, 0.3);

    // Net Pay (highlighted)
    drawText(doc, 'Net Pay', MARGIN + thirdW * 2.5, y + 7, { size: 8, color: COLORS.label, align: 'center' });
    drawText(doc, `Rs.${data.netSalary}`, MARGIN + thirdW * 2.5, y + 13, { size: 14, color: COLORS.emerald, style: 'bold', align: 'center' });

    // Amount in words
    drawText(doc, `Amount in words: ${data.amountInWords}`, PAGE_W / 2, y + 22, { size: 7.5, color: COLORS.muted, style: 'italic', align: 'center' });

    return y + sectionH;
};

/** Draw signature lines */
const drawSignatures = (doc, y) => {
    const sigY = y + 15;
    const lineW = 50;

    // Employee signature (left)
    drawLine(doc, MARGIN + 15, sigY, MARGIN + 15 + lineW, sigY, COLORS.light, 0.5);
    drawText(doc, 'Employee Signature', MARGIN + 15 + lineW / 2, sigY + 5, { size: 7.5, color: COLORS.muted, align: 'center' });

    // Authorised signatory (right)
    drawLine(doc, PAGE_W - MARGIN - 15 - lineW, sigY, PAGE_W - MARGIN - 15, sigY, COLORS.light, 0.5);
    drawText(doc, 'Authorised Signatory', PAGE_W - MARGIN - 15 - lineW / 2, sigY + 5, { size: 7.5, color: COLORS.muted, align: 'center' });

    return sigY + 10;
};

/** Draw footer */
const drawFooter = (doc, y, data) => {
    drawLine(doc, MARGIN, y, PAGE_W - MARGIN, y, COLORS.border, 0.3);
    drawText(doc, `This is a system generated document. Generated By: ${data.generatedBy} on ${data.generatedDate} (v${data.payslipVersion})`, PAGE_W / 2, y + 5, {
        size: 7,
        color: COLORS.light,
        align: 'center'
    });
    drawText(doc, 'ItzoFood Enterprise HRMS — Confidential', PAGE_W / 2, y + 10, {
        size: 6.5,
        color: COLORS.light,
        style: 'italic',
        align: 'center'
    });
};

// ── Main Render Function ─────────────────────────────────────────────────────

/**
 * Render a complete payslip as a professional A4 PDF buffer.
 *
 * @param {Object} data - Renderer-ready data from dataBuilder.js
 * @returns {Buffer}    - PDF document buffer
 */
export const renderPayslipPdf = (data) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    // ── Header ───────────────────────────────────────────────────────────────
    let y = drawHeader(doc, data);

    // ── Detail Cards (2-column grid) ─────────────────────────────────────────
    const cardStartY = y;
    const halfW = (CONTENT_W - 6) / 2;
    const leftX = MARGIN;
    const rightX = MARGIN + halfW + 6;

    const leftCardBottom = drawDetailCard(doc, leftX, cardStartY, 'EMPLOYEE DETAILS', [
        ['Name:', data.employeeName],
        ['Employee ID:', data.employeeId],
        ['Designation:', data.designation],
        ['Department:', data.department],
        ['Joining Date:', data.joiningDate],
    ], halfW);

    const rightCardBottom = drawDetailCard(doc, rightX, cardStartY, 'ATTENDANCE & BANK INFO', [
        ['Working Days:', String(data.totalWorkingDays)],
        ['Present Days:', String(data.presentDays)],
        ['LOP Days:', String(data.lopDays)],
        ['Bank Name:', data.bankName],
        ['Account No:', data.accountNumber],
        ['PAN:', data.panNumber],
    ], halfW);

    y = Math.max(leftCardBottom, rightCardBottom) + 6;

    // ── Salary Breakdown Tables (2-column) ───────────────────────────────────
    const earningsBottom = drawBreakdownTable(doc, leftX, y, 'Earnings', [
        ['Basic Salary', data.baseSalary],
        ['Overtime Bonus', data.overtimeBonus],
        ['Reimbursements', data.reimbursements],
    ], ['Gross Earnings', data.grossEarnings], halfW);

    const deductionsBottom = drawBreakdownTable(doc, rightX, y, 'Deductions', [
        ['LOP Deduction', data.lopDeduction],
        ['Short Hours Deduction', data.shortHourDeduction],
        ['PF', '0.00'],
        ['ESI', '0.00'],
        ['Tax', '0.00'],
    ], ['Total Deductions', data.totalDeductions], halfW);

    y = Math.max(earningsBottom, deductionsBottom) + 8;

    // ── Net Pay Summary ──────────────────────────────────────────────────────
    y = drawSummarySection(doc, y, data) + 6;

    // ── Signatures ───────────────────────────────────────────────────────────
    y = drawSignatures(doc, y);

    // ── Footer ───────────────────────────────────────────────────────────────
    drawFooter(doc, y + 8, data);

    // ── Export PDF buffer ─────────────────────────────────────────────────────
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
};

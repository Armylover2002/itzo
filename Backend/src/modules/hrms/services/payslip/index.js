/**
 * Payslip Generation Service — Orchestrator
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the public API surface consumed by salary.controller.js.
 * It composes the three internal layers:
 *
 *   1. dataBuilder        → Transforms salary records into renderer-ready data
 *   2. pdfRenderer        → Generates a professional A4 PDF using jsPDF
 *   3. payslipUploader    → Stores the PDF buffer in the server uploads folder
 *
 * Exported functions maintain backward compatibility with the controller:
 *   - generatePayslipPdf(data)                → Buffer (PDF)
 *   - uploadPayslip(buffer, name)              → URL string
 *   - buildPayslipData(salary, reqUser)        → data object
 * ──────────────────────────────────────────────────────────────────────────────
 */

export { buildPayslipData } from './dataBuilder.js';
export { renderPayslipPdf as generatePayslipImage } from './pdfRenderer.js';
export { uploadPayslip } from './payslipUploader.js';

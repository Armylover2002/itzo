/**
 * Payslip Generation Service — Orchestrator
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the public API surface consumed by salary.controller.js.
 * It composes the three internal layers:
 *
 *   1. dataBuilder        → Transforms salary records into renderer-ready data
 *   2. canvasRenderer     → Draws the payslip onto a canvas and exports PNG
 *   3. cloudinaryUploader → Streams the PNG buffer to Cloudinary
 *
 * Exported functions maintain backward compatibility with the controller:
 *   - generatePayslipImage(data)             → Buffer
 *   - uploadPayslipToCloudinary(buffer, name) → URL string
 *   - buildPayslipData(salary, reqUser)       → data object
 * ──────────────────────────────────────────────────────────────────────────────
 */

export { buildPayslipData } from './dataBuilder.js';
export { renderPayslipImage as generatePayslipImage } from './canvasRenderer.js';
export { uploadPayslipToCloudinary } from './cloudinaryUploader.js';

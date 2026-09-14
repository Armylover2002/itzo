import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Partnership certificate generated when a partner is approved.
 *
 * The wording differs per partner type but the layout is shared:
 *   restaurant -> "ITZOFOOD PARTNERS PVT LTD" / "RESTAURANT PARTNER" / Partners in Food
 *   seller     -> "ITZO PARTNERS PVT LTD"     / "QUICK COMMERCE PARTNER" / Partners in Quick Commerce
 */
const PARTNER_TYPES = {
  restaurant: {
    company: 'ITZOFOOD PARTNERS PVT LTD',
    heading: 'RESTAURANT PARTNER',
    partnerLabel: 'Restaurant Partner',
    idLabel: 'Restaurant Partner ID',
    brand: 'ITZOFOOD',
    tagline: '"Partners in Food. Partners in Growth"',
    accent: [13, 49, 91], // navy, matching the ITZO RESTAURANT logo
    logoFile: 'restaurant-logo.png',
  },
  seller: {
    company: 'ITZO PARTNERS PVT LTD',
    heading: 'QUICK COMMERCE PARTNER',
    partnerLabel: 'Quick Commerce Partner',
    idLabel: 'Seller Partner ID',
    brand: 'ITZO',
    tagline: '"Partners in Quick Commerce. Partners in Growth"',
    accent: [231, 29, 40], // red, matching the ITZO SELLER logo
    logoFile: 'seller-logo.png',
  },
};

const ASSETS_DIR = path.resolve(process.cwd(), 'src/assets/certificates');

/**
 * jsPDF can embed PNG and JPEG only. Uploaded brand logos are often WebP behind a
 * .png name, so the format is detected from the file signature and anything it
 * cannot read falls back to the bundled PNG for that partner type.
 */
const detectImageFormat = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'PNG';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'JPEG';
  return null;
};

const loadLogo = (type) => {
  const bundled = path.join(ASSETS_DIR, PARTNER_TYPES[type].logoFile);
  try {
    const buffer = fs.readFileSync(bundled);
    const format = detectImageFormat(buffer);
    if (format) return { buffer, format };
  } catch (error) {
    logger.warn(`Certificate logo missing for ${type}: ${error.message}`);
  }
  return null;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Builds the approval certificate PDF.
 *
 * @param {'restaurant'|'seller'} type
 * @param {{ partnerName: string, partnerId: string, onboardingDate?: Date|string }} details
 * @returns {Promise<Buffer|null>} PDF bytes, or null when it could not be produced
 */
export const generatePartnerCertificate = async (type, details = {}) => {
  const preset = PARTNER_TYPES[type];
  if (!preset) {
    logger.warn(`Unknown certificate partner type: ${type}`);
    return null;
  }

  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 64;
    const [r, g, b] = preset.accent;

    // Accent band down the left edge keeps the two variants visually distinct.
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, 10, doc.internal.pageSize.getHeight(), 'F');

    let y = 70;

    const logo = loadLogo(type);
    if (logo) {
      doc.addImage(logo.buffer, logo.format, marginX, y, 84, 84);
    }
    y += 84 + 34;

    doc.setTextColor(17, 24, 39);
    doc.setFont('times', 'bold');
    doc.setFontSize(21);
    doc.text(preset.company, marginX, y);

    y += 27;
    doc.setFontSize(15);
    doc.text(preset.heading, marginX, y);

    y += 24;
    doc.setFontSize(12.5);
    doc.text('CERTIFICATE OF PARTNERSHIP', marginX, y);

    y += 34;
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.text('This is to certify that', marginX, y);

    // Partner name on its ruled line.
    y += 26;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(String(details.partnerName || ''), marginX, y);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.8);
    doc.line(marginX, y + 6, marginX + 290, y + 6);

    y += 34;
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    const body = `has been successfully onboarded as an ${preset.company} . ${preset.partnerLabel}.`;
    const bodyLines = doc.splitTextToSize(body, pageWidth - marginX * 2);
    doc.text(bodyLines, marginX, y);

    y += bodyLines.length * 16 + 10;
    doc.text('We look forward to building a successful and long-term partnership.', marginX, y);

    // Identifiers
    y += 34;
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    const idLabel = `${preset.idLabel}: `;
    doc.text(idLabel, marginX, y);
    const idOffset = doc.getTextWidth(idLabel);
    doc.setFont('times', 'normal');
    doc.text(String(details.partnerId || ''), marginX + idOffset, y);

    y += 24;
    doc.setFont('times', 'bold');
    const dateLabel = 'Onboarding Date: ';
    doc.text(dateLabel, marginX, y);
    const dateOffset = doc.getTextWidth(dateLabel);
    doc.setFont('times', 'normal');
    doc.text(formatDate(details.onboardingDate), marginX + dateOffset, y);

    // Sign-off
    y += 44;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(r, g, b);
    doc.text(preset.brand, marginX, y);

    y += 20;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.text(preset.tagline, marginX, y);

    return Buffer.from(doc.output('arraybuffer'));
  } catch (error) {
    logger.error(`Failed to build ${type} partnership certificate: ${error.message}`);
    return null;
  }
};

export const getCertificateFileName = (type, partnerName = '') => {
  const safeName = String(partnerName)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || type;
  return `ITZO-Partnership-Certificate-${safeName}.pdf`;
};

export const getPartnerPreset = (type) => PARTNER_TYPES[type] || null;

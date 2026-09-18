import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from './logger.js';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { emailHost, emailPort, emailUser, emailPass } = config;
    if (!emailHost || !emailUser || !emailPass) {
        logger.warn('Email not configured: EMAIL_HOST, EMAIL_USER, EMAIL_PASS required');
        return null;
    }
    transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort || 587,
        secure: emailPort === 465,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
    return transporter;
}

/**
 * Send OTP email for admin forgot password.
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendAdminResetOtpEmail(to, otp) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Admin OTP email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Your password reset code – Dukaanwallah Admin';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Password reset code</h2>
  <p>Use the code below to reset your admin password. It is valid for 10 minutes.</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${otp}</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Dukaanwallah Admin</p>
</body>
</html>`;
    const text = `Your password reset code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Dukaanwallah <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Admin reset OTP email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send admin OTP email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send credentials to a new employee.
 * @param {string} to - Recipient email
 * @param {string} password - The generated/provided password
 * @param {string} roleName - The assigned role name
 * @param {string} loginUrl - The login portal URL
 * @returns {Promise<boolean>}
 */
export async function sendEmployeeCredentialsEmail(to, password, roleName, loginUrl, employeeId) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Employee credentials email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Welcome to Dukaanwallah Admin – Your Login Credentials';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Welcome to the Team!</h2>
  <p>You have been added to the Dukaanwallah Admin Panel with the role of <strong>${roleName}</strong>.</p>
  <p>Here are your login credentials:</p>
  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 15px 0;">
    <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${employeeId || 'N/A'}</p>
    <p style="margin: 5px 0;"><strong>Email/Username:</strong> ${to}</p>
    <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
  </div>
  <p>Please log in using the link below:</p>
  <p><a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>
  <p style="color: #666; font-size: 14px; margin-top: 20px;">For security reasons, we recommend changing your password after your first login.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Dukaanwallah Team</p>
 </body>
</html>`;
    const text = `Welcome to Dukaanwallah Admin. You have been assigned the role: ${roleName}. Employee ID: ${employeeId}. Email: ${to}. Password: ${password}. Login at: ${loginUrl}`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Dukaanwallah <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Employee credentials email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send credentials email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send OTP email for user registration / login.
 * @param {string} to - Recipient email
 * @param {string} otp - 4-digit OTP
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendUserOtpEmail(to, otp) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('User OTP email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Your verification code – Itzo';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Email Verification Code</h2>
  <p>Use the code below to verify your email. It is valid for 5 minutes.</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${otp}</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Itzo Team</p>
</body>
</html>`;
    const text = `Your verification code is: ${otp}. It is valid for 5 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Itzo <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`User OTP email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send user OTP email to ${to}:`, err.message);
        return false;
    }
}

function asSafeText(value, fallback = "there") {
    const text = String(value || "").trim();
    return text || fallback;
}

/**
 * Send approval email to restaurant after admin verification.
 * @param {string} to - Restaurant registered email
 * @param {object} payload - Email data
 * @returns {Promise<boolean>}
 */
export async function sendRestaurantApprovalEmail(to, payload = {}) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn("Restaurant approval email skipped: SMTP not configured");
        return false;
    }
    const recipient = String(to || "").trim();
    if (!recipient) return false;

    const from = config.emailFrom || config.emailUser;
    const restaurantName = asSafeText(payload.restaurantName, "your restaurant");
    const ownerName = asSafeText(payload.ownerName, "Partner");
    const subject = "Restaurant Approval Confirmed - ItzoFood";
    const text = `Hi ${ownerName}, your restaurant "${restaurantName}" has been approved by admin. You can now log in and start accepting orders on ItzoFood.`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111; margin: 0 0 12px;">Restaurant Approved</h2>
  <p>Hi ${ownerName},</p>
  <p>Your restaurant <strong>${restaurantName}</strong> has been approved by admin.</p>
  <p>You can now log in to your app and start accepting orders.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;

    try {
        await trans.sendMail({
            from: typeof from === "string" && from.includes("<") ? from : `ItzoFood <${from}>`,
            to: recipient,
            subject,
            text,
            html,
        });
        logger.info(`Restaurant approval email sent to ${recipient}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send restaurant approval email to ${recipient}:`, err.message);
        return false;
    }
}

/**
 * Send approval email to delivery partner after admin verification.
 * @param {string} to - Delivery partner registered email
 * @param {object} payload - Email data
 * @returns {Promise<boolean>}
 */
export async function sendDeliveryApprovalEmail(to, payload = {}) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn("Delivery approval email skipped: SMTP not configured");
        return false;
    }
    const recipient = String(to || "").trim();
    if (!recipient) return false;

    const from = config.emailFrom || config.emailUser;
    const partnerName = asSafeText(payload.name, "Partner");
    const subject = "Delivery Partner Approval Confirmed - ItzoFood";
    const text = `Hi ${partnerName}, your delivery partner profile has been approved by admin. You can now go online and start taking trips on ItzoFood.`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111; margin: 0 0 12px;">Delivery Partner Approved</h2>
  <p>Hi ${partnerName},</p>
  <p>Your delivery partner profile has been approved by admin.</p>
  <p>You can now open the app, go online, and start taking trips.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;

    try {
        await trans.sendMail({
            from: typeof from === "string" && from.includes("<") ? from : `ItzoFood <${from}>`,
            to: recipient,
            subject,
            text,
            html,
        });
        logger.info(`Delivery approval email sent to ${recipient}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send delivery approval email to ${recipient}:`, err.message);
        return false;
    }
}

/**
 * Send seller onboarding/profile approval or rejection email.
 * @param {string} to
 * @param {object} payload
 * @returns {Promise<boolean>}
 */
export async function sendSellerStatusEmail(to, payload = {}) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn("Seller status email skipped: SMTP not configured");
        return false;
    }
    const recipient = String(to || "").trim();
    if (!recipient) return false;

    const from = config.emailFrom || config.emailUser;
    const sellerName = asSafeText(payload.name, "Seller");
    const shopName = asSafeText(payload.shopName, "");
    const heading = asSafeText(
        payload.title,
        payload.status === "rejected" ? "Seller application update" : "Seller application approved"
    );
    const body = asSafeText(payload.message, "There is an update on your ItzoFood seller account.");
    const shopLine = shopName ? `Shop: ${shopName}` : "";
    const subject = heading;
    const text = [`Hi ${sellerName},`, shopLine, body, "Open the ItzoFood seller app to see the latest status."]
        .filter(Boolean)
        .join("\n");
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111; margin: 0 0 12px;">${heading}</h2>
  <p>Hi ${sellerName},</p>
  ${shopName ? `<p>Shop: <strong>${shopName}</strong></p>` : ""}
  <p>${body}</p>
  <p>Open the ItzoFood seller app to see the latest status.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;

    try {
        await trans.sendMail({
            from: typeof from === "string" && from.includes("<") ? from : `ItzoFood <${from}>`,
            to: recipient,
            subject,
            text,
            html,
        });
        logger.info(`Seller status email sent to ${recipient}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send seller status email to ${recipient}:`, err.message);
        return false;
    }
}

/**
 * Send rejection email to restaurant after admin decision.
 */
export async function sendRestaurantRejectionEmail(to, payload = {}) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn("Restaurant rejection email skipped: SMTP not configured");
        return false;
    }
    const recipient = String(to || "").trim();
    if (!recipient) return false;

    const from = config.emailFrom || config.emailUser;
    const restaurantName = asSafeText(payload.restaurantName, "your restaurant");
    const ownerName = asSafeText(payload.ownerName, "Partner");
    const reason = asSafeText(payload.reason, "Incomplete documents");
    const subject = "Restaurant Application Update - ItzoFood";
    const text = `Hi ${ownerName}, your restaurant "${restaurantName}" registration was not approved. Reason: ${reason}.`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111; margin: 0 0 12px;">Restaurant Application Update</h2>
  <p>Hi ${ownerName},</p>
  <p>Your restaurant <strong>${restaurantName}</strong> registration was not approved.</p>
  <p><strong>Reason:</strong> ${reason}</p>
  <p>You may update your details and re-apply if eligible.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;

    try {
        await trans.sendMail({
            from: typeof from === "string" && from.includes("<") ? from : `ItzoFood <${from}>`,
            to: recipient,
            subject,
            text,
            html,
        });
        logger.info(`Restaurant rejection email sent to ${recipient}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send restaurant rejection email to ${recipient}:`, err.message);
        return false;
    }
}

/**
 * Send rejection email to delivery partner after admin decision.
 */
export async function sendDeliveryRejectionEmail(to, payload = {}) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn("Delivery rejection email skipped: SMTP not configured");
        return false;
    }
    const recipient = String(to || "").trim();
    if (!recipient) return false;

    const from = config.emailFrom || config.emailUser;
    const partnerName = asSafeText(payload.name, "Partner");
    const reason = asSafeText(payload.reason, "Application incomplete");
    const subject = "Delivery Partner Application Update - ItzoFood";
    const text = `Hi ${partnerName}, your delivery partner application was not approved. Reason: ${reason}.`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111; margin: 0 0 12px;">Delivery Partner Application Update</h2>
  <p>Hi ${partnerName},</p>
  <p>Your delivery partner application was not approved.</p>
  <p><strong>Reason:</strong> ${reason}</p>
  <p>You may update your details and re-apply if eligible.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;

    try {
        await trans.sendMail({
            from: typeof from === "string" && from.includes("<") ? from : `ItzoFood <${from}>`,
            to: recipient,
            subject,
            text,
            html,
        });
        logger.info(`Delivery rejection email sent to ${recipient}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send delivery rejection email to ${recipient}:`, err.message);
        return false;
    }
}

/**
 * Approval email for a partner, carrying the partnership certificate as a PDF.
 *
 * Used for both restaurants and quick-commerce sellers, and for every approval —
 * a first onboarding as well as an approval after a rejection and re-application.
 *
 * @param {string} to - partner's email address
 * @param {object} options
 * @param {'restaurant'|'seller'} options.type
 * @param {string} options.partnerName - shop / restaurant name
 * @param {string} options.partnerId - readable partner id shown on the certificate
 * @param {Date|string} [options.onboardingDate]
 * @returns {Promise<boolean>} true when the mail was accepted for delivery
 */
export async function sendPartnerApprovalCertificateEmail(to, options = {}) {
    if (!to) return false;

    const trans = getTransporter();
    if (!trans) {
        logger.warn('Partner approval certificate email skipped: SMTP not configured');
        return false;
    }

    const { type, partnerName, partnerId, onboardingDate } = options;
    const { generatePartnerCertificate, getCertificateFileName, getPartnerPreset } =
        await import('../services/partnerCertificate.service.js');

    const preset = getPartnerPreset(type);
    if (!preset) {
        logger.warn(`Partner approval email skipped: unknown partner type "${type}"`);
        return false;
    }

    const certificate = await generatePartnerCertificate(type, {
        partnerName,
        partnerId,
        onboardingDate,
    });

    const from = config.emailFrom || config.emailUser;
    const accent = `rgb(${preset.accent.join(',')})`;
    const subject = `Welcome aboard! "${partnerName}" is approved – ${preset.brand}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: ${accent}; margin-bottom: 4px;">Congratulations! 🎉</h2>
  <p style="margin-top: 0; color: #666; font-size: 13px;">${preset.company}</p>
  <p>Dear Partner,</p>
  <p><strong>${partnerName}</strong> has been successfully verified and onboarded as an
     <strong>${preset.partnerLabel}</strong>.</p>
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f7f7f9; border-radius: 8px; margin: 16px 0;">
    <tr><td style="padding: 10px 14px; color: #666; font-size: 13px;">${preset.idLabel}</td>
        <td style="padding: 10px 14px; font-weight: bold; text-align: right;">${partnerId}</td></tr>
    <tr><td style="padding: 10px 14px; color: #666; font-size: 13px; border-top: 1px solid #e6e6e6;">Onboarding date</td>
        <td style="padding: 10px 14px; font-weight: bold; text-align: right; border-top: 1px solid #e6e6e6;">${new Date(onboardingDate || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
  </table>
  ${certificate
        ? '<p>Your official <strong>Certificate of Partnership</strong> is attached to this email as a PDF.</p>'
        : ''}
  <p>You can now log in to your dashboard and start operating.</p>
  <p>We look forward to building a successful and long-term partnership.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">${preset.tagline}<br>${preset.brand} Team</p>
</body>
</html>`;

    const text = [
        'Congratulations!',
        '',
        `${partnerName} has been successfully verified and onboarded as an ${preset.partnerLabel}.`,
        '',
        `${preset.idLabel}: ${partnerId}`,
        `Onboarding date: ${new Date(onboardingDate || Date.now()).toLocaleDateString('en-IN')}`,
        '',
        certificate ? 'Your Certificate of Partnership is attached as a PDF.' : '',
        'You can now log in to your dashboard and start operating.',
        '',
        `${preset.tagline}`,
        `${preset.brand} Team`,
    ].filter(Boolean).join('\n');

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `${preset.brand} <${from}>`,
            to,
            subject,
            text,
            html,
            attachments: certificate
                ? [{
                    filename: getCertificateFileName(type, partnerName),
                    content: certificate,
                    contentType: 'application/pdf',
                }]
                : [],
        });
        logger.info(`Partner approval certificate email sent to ${to} (${type})`);
        return true;
    } catch (err) {
        logger.error(`Failed to send partner approval certificate email to ${to}: ${err.message}`);
        return false;
    }
}

export async function sendJobApplicationAcknowledgementEmail(to, applicantName, jobTitle) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Job application acknowledgement email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = `Application Received: ${jobTitle} – ItzoFood`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Hello ${applicantName},</h2>
  <p>Thank you for applying for the <strong>${jobTitle}</strong> position at ItzoFood!</p>
  <p>We have successfully received your application and resume. Our recruitment team is currently reviewing all submissions to identify candidates whose qualifications best match our needs.</p>
  <p>If your profile is shortlisted, someone from our team will contact you to discuss the next steps in the interview process.</p>
  <p>We appreciate your interest in joining ItzoFood and wish you the best of luck!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Best Regards,<br>ItzoFood Careers Team</p>
</body>
</html>`;
    const text = `Hello ${applicantName},\n\nThank you for applying for the ${jobTitle} position at ItzoFood!\n\nWe have successfully received your application. If your profile matches, someone from our team will reach out to you.\n\nBest Regards,\nItzoFood Careers Team`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `ItzoFood Careers <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Job application acknowledgement email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send job application acknowledgement email to ${to}:`, err.message);
        return false;
    }
}

export async function sendLicensingAcknowledgementEmail(to, ownerName, restaurantName, vendor) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Licensing acknowledgment email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = `Licensing Support Request Received – ItzoFood`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Hello ${ownerName},</h2>
  <p>Thank you for submitting a licensing support request for <strong>${restaurantName}</strong> on ItzoFood.</p>
  <p>We have forwarded your details to our trusted licensing partner, <strong>${vendor}</strong>. A representative from their team will contact you shortly on your registered contact details to assist you with the licensing and compliance onboarding process.</p>
  <p>If you have any questions in the meantime, feel free to reach out to us.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Best Regards,<br>ItzoFood Consulting & Licensing Team</p>
</body>
</html>`;
    const text = `Hello ${ownerName},\n\nThank you for submitting a licensing support request for ${restaurantName} on ItzoFood.\n\nWe have forwarded your details to our trusted licensing partner, ${vendor}. A representative from their team will contact you shortly to assist with your licensing and compliance onboarding.\n\nBest Regards,\nItzoFood Consulting Team`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `ItzoFood Consulting <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Licensing acknowledgement email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send licensing acknowledgement email to ${to}:`, err.message);
        return false;
    }
}

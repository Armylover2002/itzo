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
    const subject = 'Your password reset code – ItzoFood Admin';
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
  <p style="color: #999; font-size: 12px;">ItzoFood Admin</p>
</body>
</html>`;
    const text = `Your password reset code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `ItzoFood <${from}>`,
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
export async function sendEmployeeCredentialsEmail(to, password, roleName, loginUrl) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Employee credentials email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Welcome to ItzoFood Admin – Your Login Credentials';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Welcome to the Team!</h2>
  <p>You have been added to the ItzoFood Admin Panel with the role of <strong>${roleName}</strong>.</p>
  <p>Here are your login credentials:</p>
  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 15px 0;">
    <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
    <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
  </div>
  <p>Please log in using the link below:</p>
  <p><a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>
  <p style="color: #666; font-size: 14px; margin-top: 20px;">For security reasons, we recommend changing your password after your first login.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">ItzoFood Team</p>
</body>
</html>`;
    const text = `Welcome to ItzoFood Admin. You have been assigned the role: ${roleName}. Email: ${to}. Password: ${password}. Login at: ${loginUrl}`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `ItzoFood <${from}>`,
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
 * Send acknowledgment email to a job applicant.
 * @param {string} to - Recipient email
 * @param {string} applicantName - The candidate's name
 * @param {string} jobTitle - The title of the job applied for
 * @returns {Promise<boolean>}
 */
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

/**
 * Send acknowledgment email to a licensing request applicant.
 * @param {string} to - Recipient email
 * @param {string} ownerName - The owner's name
 * @param {string} restaurantName - The restaurant's name
 * @param {string} vendor - The selected consultant vendor
 * @returns {Promise<boolean>}
 */
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

/**
 * Send approval notification email to a restaurant.
 * @param {string} to - Recipient email
 * @param {string} restaurantName - The restaurant's name
 * @returns {Promise<boolean>}
 */
export async function sendRestaurantApprovalEmail(to, restaurantName) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Restaurant approval email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = `Your Restaurant "${restaurantName}" is Approved! 🎉 – ItzoFood`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Congratulations! 🎉</h2>
  <p>We are thrilled to inform you that your restaurant <strong>${restaurantName}</strong> has been successfully verified and approved on ItzoFood.</p>
  <p>You can now log into your restaurant dashboard to manage your menu, view analytics, and start accepting orders.</p>
  <p>Welcome to the ItzoFood family! We look forward to a successful partnership.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Best Regards,<br>ItzoFood Team</p>
</body>
</html>`;
    const text = `Congratulations!\n\nWe are thrilled to inform you that your restaurant ${restaurantName} has been successfully verified and approved on ItzoFood.\n\nYou can now log into your restaurant dashboard and start accepting orders.\n\nBest Regards,\nItzoFood Team`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `ItzoFood <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Restaurant approval email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send restaurant approval email to ${to}:`, err.message);
        return false;
    }
}



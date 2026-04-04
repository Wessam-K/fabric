/**
 * Email delivery module using nodemailer.
 * Falls back to logger output when SMTP is not configured.
 *
 * Environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 *   APP_BASE_URL (default: http://localhost:9002)
 */
const logger = require('./logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
    return transporter;
  } catch (err) {
    logger.error('Failed to initialize email transport', { error: err.message });
    return null;
  }
}

function getFromAddress() {
  return process.env.SMTP_FROM || 'noreply@wk-factory.local';
}

function getBaseUrl() {
  return process.env.APP_BASE_URL || 'http://localhost:9002';
}

/**
 * Send a password reset email.
 */
async function sendPasswordReset(email, rawToken, baseUrl) {
  const url = `${baseUrl || getBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const subject = 'WK-Factory — إعادة تعيين كلمة المرور';
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1e40af;">إعادة تعيين كلمة المرور</h2>
      <p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بك. اضغط على الرابط أدناه لإعادة التعيين:</p>
      <p style="margin:24px 0;">
        <a href="${url}" style="background:#1e40af;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          إعادة تعيين كلمة المرور
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">هذا الرابط صالح لمدة ساعة واحدة فقط. إذا لم تطلب هذا، يمكنك تجاهل هذا البريد.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;">WK-Factory ERP System</p>
    </div>
  `;

  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Password reset requested but SMTP not configured', { email });
    } else {
      logger.info('Password reset token (SMTP not configured)', { email, token: rawToken });
    }
    return;
  }

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      html,
    });
    logger.info('Password reset email sent', { email });
  } catch (err) {
    logger.error('Failed to send password reset email', { email, error: err.message });
  }
}

/**
 * Send a user invitation email.
 */
async function sendInvitation(email, rawToken, role, baseUrl) {
  const url = `${baseUrl || getBaseUrl()}/accept-invite?token=${encodeURIComponent(rawToken)}`;
  const subject = 'WK-Factory — دعوة للانضمام';
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1e40af;">دعوة للانضمام إلى WK-Factory</h2>
      <p>تمت دعوتك للانضمام إلى نظام WK-Factory بدور <strong>${role}</strong>.</p>
      <p style="margin:24px 0;">
        <a href="${url}" style="background:#1e40af;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          قبول الدعوة وإعداد الحساب
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">هذا الرابط صالح لمدة 48 ساعة.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;">WK-Factory ERP System</p>
    </div>
  `;

  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Invitation requested but SMTP not configured', { email, role });
    } else {
      logger.info('Invitation token (SMTP not configured)', { email, role, token: rawToken });
    }
    return;
  }

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      html,
    });
    logger.info('Invitation email sent', { email, role });
  } catch (err) {
    logger.error('Failed to send invitation email', { email, error: err.message });
  }
}

module.exports = { sendPasswordReset, sendInvitation };

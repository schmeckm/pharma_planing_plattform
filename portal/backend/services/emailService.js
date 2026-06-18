import nodemailer from 'nodemailer';

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  if (!host || !user) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user,
      pass: process.env.SMTP_PASS || '',
    },
  };
}

export function isEmailConfigured() {
  return Boolean(smtpConfig());
}

export function getEmailStatus() {
  const configured = isEmailConfigured();
  return {
    configured,
    host: configured ? process.env.SMTP_HOST : null,
    port: configured ? Number(process.env.SMTP_PORT || 587) : null,
    from: process.env.MAIL_FROM || null,
    user: configured ? process.env.SMTP_USER : null,
  };
}

export async function sendMail({ to, subject, text, html }) {
  const config = smtpConfig();
  if (!config) {
    throw new Error('E-Mail ist nicht konfiguriert');
  }

  const transporter = nodemailer.createTransport(config);
  const from = process.env.MAIL_FROM || config.auth.user;

  const result = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text,
  });

  return {
    accepted: result.accepted || [],
    messageId: result.messageId,
  };
}

export async function sendTestEmail(to) {
  return sendMail({
    to,
    subject: 'Portal Test-E-Mail',
    text: 'Dies ist eine Test-E-Mail aus dem Hard Allocation Portal Admin-Bereich.',
    html: '<p>Dies ist eine <strong>Test-E-Mail</strong> aus dem Hard Allocation Portal Admin-Bereich.</p>',
  });
}

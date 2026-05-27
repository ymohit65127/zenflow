import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "noreply@zenflow.io",
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, ""),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[EMAIL]", error);
    return { success: false, error };
  }
}

export function inviteEmailHtml(opts: {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #6366f1; font-size: 28px; margin: 0;">ZenFlow</h1>
        <p style="color: #6b7280; margin-top: 4px;">Everything Flows.</p>
      </div>
      <h2 style="color: #111827;">You've been invited!</h2>
      <p style="color: #374151; line-height: 1.6;">
        <strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.orgName}</strong> on ZenFlow.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${opts.inviteUrl}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
      </p>
    </div>
  `;
}

export function passwordResetEmailHtml(opts: { resetUrl: string; userName: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #6366f1; font-size: 28px; margin: 0;">ZenFlow</h1>
      </div>
      <h2 style="color: #111827;">Reset your password</h2>
      <p style="color: #374151; line-height: 1.6;">
        Hi ${opts.userName}, we received a request to reset your password.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${opts.resetUrl}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

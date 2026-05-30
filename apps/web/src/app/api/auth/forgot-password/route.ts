import { NextResponse } from "next/server";
import { prisma } from "@zenflow/db";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { redis } from "@/lib/redis";
import { headers } from "next/headers";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    // IP-based rate limiting: max 3 requests per IP per 15 minutes
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0] ??
      headersList.get("x-real-ip") ??
      "0.0.0.0";

    const FP_KEY = `forgot_pw:${ip}`;
    const fpAttempts = await redis.incr(FP_KEY);
    if (fpAttempts === 1) await redis.expire(FP_KEY, 900); // 15 minute window

    if (fpAttempts > 3) {
      // Still return success to prevent enumeration, but don't process
      return NextResponse.json({ success: true });
    }

    const body = await req.json() as unknown;
    const { email } = schema.parse(body);

    // Always return success to prevent user enumeration
    const user = await prisma.user.findFirst({
      where: { email, deleted_at: null },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");

      // Store token in Redis with 1-hour TTL (no DB write needed)
      const TOKEN_KEY = `pw_reset:${token}`;
      const tokenData = { userId: user.id, email: user.email, createdAt: Date.now() };
      await redis.set(TOKEN_KEY, JSON.stringify(tokenData), "EX", 3600);

      const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      // Send email via nodemailer (mailpit on localhost:1025 for dev)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "localhost",
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: false,
        auth:
          process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });

      await transporter.sendMail({
        from: `ZenFlow <noreply@zenflow.app>`,
        to: user.email,
        subject: "Reset your ZenFlow password",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #6366f1;">ZenFlow Password Reset</h2>
            <p>Hi ${user.name},</p>
            <p>You requested a password reset. Click the button below to set a new password:</p>
            <a href="${resetUrl}"
               style="display:inline-block; background:#6366f1; color:#fff; text-decoration:none;
                      padding:12px 24px; border-radius:8px; font-weight:600; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #888; font-size: 12px;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #888; font-size: 12px;">
              Or copy this link: ${resetUrl}
            </p>
          </div>
        `,
      });
    }

    // Always return success
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    console.error("[FORGOT-PASSWORD]", err);
    return NextResponse.json({ success: true }); // Don't reveal server errors
  }
}

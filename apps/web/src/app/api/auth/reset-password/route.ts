import { NextResponse } from "next/server";
import { prisma } from "@zenflow/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;
    const { token, newPassword } = schema.parse(body);

    // Find user by reset token stored in metadata
    const users = await prisma.user.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        metadata: true,
      },
    });

    // Filter in JS since metadata is Json
    const user = users.find((u) => {
      const meta =
        typeof u.metadata === "object" && u.metadata !== null
          ? (u.metadata as Record<string, unknown>)
          : {};
      return (
        meta.resetToken === token &&
        typeof meta.resetTokenExpires === "string" &&
        new Date(meta.resetTokenExpires) > new Date()
      );
    });

    if (!user) {
      return NextResponse.json(
        { error: "This reset link has expired or is invalid. Please request a new one." },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear token
    const currentMeta =
      typeof user.metadata === "object" && user.metadata !== null
        ? (user.metadata as Record<string, unknown>)
        : {};

    const { resetToken: _rt, resetTokenExpires: _rte, ...restMeta } = currentMeta;
    void _rt;
    void _rte;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: newHash,
        metadata: restMeta as Record<string, string>,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message ?? "Validation error" },
        { status: 400 }
      );
    }
    console.error("[RESET-PASSWORD]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

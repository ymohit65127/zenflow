import { NextResponse } from "next/server";
import { prisma } from "@zenflow/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redis } from "@/lib/redis";
import { passwordSchema } from "@/lib/password-schema";

const schema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;
    const { token, newPassword } = schema.parse(body);

    // O(1) Redis lookup — replaces full user-table scan
    const TOKEN_KEY = `pw_reset:${token}`;
    const tokenDataRaw = await redis.get(TOKEN_KEY);

    if (!tokenDataRaw) {
      return NextResponse.json(
        { error: "This reset link has expired or is invalid. Please request a new one." },
        { status: 400 }
      );
    }

    const tokenData = JSON.parse(tokenDataRaw) as {
      userId: string;
      email: string;
      createdAt: number;
    };

    // Delete token immediately (single-use)
    await redis.del(TOKEN_KEY);

    // Fetch the user by indexed ID — O(1)
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId, deleted_at: null },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
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

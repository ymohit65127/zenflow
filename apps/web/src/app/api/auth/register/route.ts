import { NextResponse } from "next/server";
import { prisma } from "@zenflow/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  orgName: z.string().min(2).max(100),
  orgSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;
    const data = registerSchema.parse(body);

    // Check if slug taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: data.orgSlug },
    });
    if (existingOrg) {
      return NextResponse.json({ error: "This workspace URL is already taken." }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create org + user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.orgName,
          slug: data.orgSlug,
          plan: "FREE",
          max_users: 5,
        },
      });

      const user = await tx.user.create({
        data: {
          organization_id: org.id,
          email: data.email,
          name: data.name,
          password_hash: passwordHash,
          email_verified: false,
          is_owner: true,
          is_active: true,
        },
      });

      // Create admin role
      const adminRole = await tx.role.create({
        data: {
          organization_id: org.id,
          name: "Administrator",
          description: "Full access",
          is_system: true,
        },
      });

      // Assign role
      await tx.userRole.create({
        data: { user_id: user.id, role_id: adminRole.id },
      });

      // Create default channel
      await tx.channel.create({
        data: {
          organization_id: org.id,
          name: "general",
          type: "PUBLIC",
          description: "General discussion",
        },
      });

      return { org, user };
    });

    return NextResponse.json({
      success: true,
      userId: result.user.id,
      orgId: result.org.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Validation error" }, { status: 400 });
    }
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

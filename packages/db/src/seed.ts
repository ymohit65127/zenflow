import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding ZenFlow database...");

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Company",
      slug: "demo-org",
      plan: "PROFESSIONAL",
      max_users: 50,
      timezone: "UTC",
      locale: "en",
      currency: "USD",
    },
  });
  console.log("✅ Organization created:", org.name);

  // Create owner user
  const user = await prisma.user.upsert({
    where: { organization_id_email: { organization_id: org.id, email: "admin@demo.com" } },
    update: {},
    create: {
      organization_id: org.id,
      email: "admin@demo.com",
      name: "Admin User",
      email_verified: true,
      is_owner: true,
      is_active: true,
      // Password: Demo@123456
      password_hash: "$2a$12$1jFH9kzAz4PTU5nwcCQ6r.G97c0EW0015rEdl1EqhQ.9/0K/ypGPi",
    },
  });
  console.log("✅ Admin user created:", user.email);

  // Create default roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { organization_id_name: { organization_id: org.id, name: "Administrator" } },
      update: {},
      create: {
        organization_id: org.id,
        name: "Administrator",
        description: "Full access to all modules",
        is_system: true,
      },
    }),
    prisma.role.upsert({
      where: { organization_id_name: { organization_id: org.id, name: "Manager" } },
      update: {},
      create: {
        organization_id: org.id,
        name: "Manager",
        description: "Manage teams and view reports",
        is_system: true,
      },
    }),
    prisma.role.upsert({
      where: { organization_id_name: { organization_id: org.id, name: "Member" } },
      update: {},
      create: {
        organization_id: org.id,
        name: "Member",
        description: "Standard team member access",
        is_system: true,
      },
    }),
  ]);
  console.log("✅ Default roles created:", roles.map((r) => r.name).join(", "));

  // Assign Administrator role to owner
  await prisma.userRole.upsert({
    where: { user_id_role_id: { user_id: user.id, role_id: roles[0]!.id } },
    update: {},
    create: {
      user_id: user.id,
      role_id: roles[0]!.id,
    },
  });

  // Seed permissions
  const modules = [
    "crm", "forms", "analytics", "projects", "hr",
    "helpdesk", "accounting", "inventory", "workflows",
    "documents", "chat", "settings",
  ];
  const resources = ["contacts", "leads", "deals", "tasks", "tickets", "invoices", "products", "employees"];
  const actions = ["create", "read", "update", "delete", "export", "manage"];

  const permData = modules.flatMap((module) =>
    ["*"].flatMap((resource) =>
      actions.map((action) => ({
        module,
        resource,
        action,
        description: `${action} ${resource} in ${module}`,
      }))
    )
  );

  await prisma.permission.createMany({
    data: permData,
    skipDuplicates: true,
  });
  console.log("✅ Permissions seeded");

  // Create sample CRM pipeline
  const pipeline = await prisma.crmPipeline.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organization_id: org.id,
      name: "Sales Pipeline",
      is_default: true,
    },
  });

  const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
  for (let i = 0; i < stages.length; i++) {
    await prisma.crmPipelineStage.create({
      data: {
        pipeline_id: pipeline.id,
        name: stages[i]!,
        sort_order: i,
        color: ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444"][i] ?? "#6366f1",
        is_closed: i >= 4,
        is_won: i === 4,
        win_probability: [10, 30, 50, 70, 100, 0][i] ?? 0,
      },
    });
  }
  console.log("✅ CRM pipeline and stages created");

  // Create a sample project
  await prisma.project.create({
    data: {
      organization_id: org.id,
      owner_id: user.id,
      name: "ZenFlow Platform Development",
      description: "Building the ZenFlow SaaS platform",
      status: "ACTIVE",
      color: "#6366f1",
    },
  });
  console.log("✅ Sample project created");

  // Create default channel
  await prisma.channel.create({
    data: {
      organization_id: org.id,
      name: "general",
      type: "PUBLIC",
      description: "General discussion for the whole team",
    },
  });
  console.log("✅ Default channel #general created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📝 Login credentials:");
  console.log("   Email: admin@demo.com");
  console.log("   Password: Demo@123456");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

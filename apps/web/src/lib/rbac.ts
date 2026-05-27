import { TRPCError } from "@trpc/server";

// Role-Based Access Control
// Check if user has permission for module+action
export async function checkPermission(
  prisma: any,
  userId: string,
  orgId: string,
  module: string,
  action: string
): Promise<boolean> {
  const permissions = await prisma.$queryRaw`
    SELECT rp.resource_scope
    FROM role_permissions rp
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ${userId}
      AND ur.org_id  = ${orgId}
      AND rp.module  = ${module}
      AND rp.action  = ${action}
    LIMIT 1
  `;
  return Array.isArray(permissions) && permissions.length > 0;
}

// Higher-order function for tRPC procedures
export function withPermission(module: string, action: string) {
  return (procedure: any) =>
    procedure.use(async ({ ctx, next }: any) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;
      const allowed = await checkPermission(ctx.prisma, userId, orgId, module, action);
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Permission denied: ${module}.${action}`,
        });
      }
      return next();
    });
}

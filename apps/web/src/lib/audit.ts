// Fire-and-forget audit log dispatcher
// Uses existing AuditLog model: organization_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent
export async function logAudit(
  prisma: any,
  params: {
    orgId: string;
    userId?: string;
    action: string; // e.g. "crm.contact.create", "hr.employee.update"
    resourceType: string; // e.g. 'contact', 'deal', 'ticket'
    resourceId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  // Fire-and-forget — never block the main operation
  prisma.auditLog
    .create({
      data: {
        organization_id: params.orgId,
        user_id: params.userId ?? null,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId ?? null,
        old_values: params.before ?? null,
        new_values: params.after ?? null,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
      },
    })
    .catch((err: unknown) => console.error("[AuditLog] Failed to write:", err));
}

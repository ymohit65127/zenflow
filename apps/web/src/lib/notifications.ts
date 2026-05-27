// Notification dispatcher — uses existing Notification model
// Fields: id, organization_id, user_id, type, title, body, data(Json), is_read, read_at, created_at
export async function sendNotification(
  prisma: any,
  params: {
    orgId: string;
    userId: string;
    type: string; // 'mention', 'task.assigned', etc.
    title: string;
    body?: string;
    link?: string;
    entityType?: string;
    entityId?: string;
  }
): Promise<void> {
  // Check quiet hours from user metadata preferences
  const user = await prisma.user
    .findUnique({
      where: { id: params.userId },
      select: { metadata: true },
    })
    .catch(() => null);

  const prefs = (user?.metadata as any)?.notification_preferences ?? {};
  const pref = prefs[params.type] ?? null;
  const channels = pref?.channels ?? { in_app: true, email: true };

  // Check quiet hours for non-in-app channels
  if (channels.email && pref?.quiet_start && pref?.timezone) {
    const inQuiet = isInQuietHours(pref.quiet_start, pref.quiet_end, pref.timezone);
    if (inQuiet) channels.email = false;
  }

  // Create in-app notification
  if (channels.in_app !== false) {
    prisma.notification
      .create({
        data: {
          organization_id: params.orgId,
          user_id: params.userId,
          type: params.type,
          title: params.title,
          body: params.body ?? null,
          data: {
            action_url: params.link ?? null,
            entity_type: params.entityType ?? null,
            entity_id: params.entityId ?? null,
          },
          is_read: false,
        },
      })
      .catch((err: unknown) => console.error("[Notifications] Failed to create:", err));
  }

  // Email channel would queue via BullMQ (placeholder)
  if (channels.email) {
    // TODO: notificationQueue.add("email", params)
  }
}

function isInQuietHours(start: string, end: string, tz: string): boolean {
  try {
    const now = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    });
    return start <= end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return false;
  }
}

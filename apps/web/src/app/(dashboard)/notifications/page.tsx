import { redirect } from "next/navigation";

// Notifications settings lives under Settings → redirect there
export default function NotificationsPage() {
  redirect("/settings/notifications");
}

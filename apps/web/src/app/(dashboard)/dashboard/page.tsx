import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { DashboardClient } from "./_components/dashboard-client";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return <DashboardClient greeting={greeting} firstName={firstName} />;
}

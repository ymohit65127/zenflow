import type { Metadata } from "next";
import { ReportsClient } from "./_components/reports-client";

export const metadata: Metadata = { title: "Analytics Reports" };

export default function ReportsPage() {
  return <ReportsClient />;
}

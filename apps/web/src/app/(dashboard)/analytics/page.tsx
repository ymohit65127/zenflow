import type { Metadata } from "next";
import { AnalyticsClient } from "./_components/analytics-client";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}

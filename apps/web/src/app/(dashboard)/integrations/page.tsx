import { redirect } from "next/navigation";

// Integrations lives under Workflows → redirect there
export default function IntegrationsPage() {
  redirect("/workflows/integrations");
}

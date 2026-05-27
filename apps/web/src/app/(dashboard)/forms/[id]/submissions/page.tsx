import type { Metadata } from "next";
import { FormSubmissionsClient } from "./_components/form-submissions-client";

export const metadata: Metadata = { title: "Form Submissions" };

export default async function FormSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormSubmissionsClient formId={id} />;
}

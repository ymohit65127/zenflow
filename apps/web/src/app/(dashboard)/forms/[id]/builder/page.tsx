import type { Metadata } from "next";
import { FormBuilderClient } from "./_components/form-builder-client";

export const metadata: Metadata = { title: "Form Builder" };

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormBuilderClient formId={id} />;
}

import type { Metadata } from "next";
import { FormsListClient } from "./_components/forms-list-client";

export const metadata: Metadata = { title: "Forms Builder" };

export default function FormsPage() {
  return <FormsListClient />;
}

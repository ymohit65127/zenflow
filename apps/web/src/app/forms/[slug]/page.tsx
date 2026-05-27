import { prisma } from "@zenflow/db";
import { PublicFormClient } from "./_components/public-form-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await prisma.form.findFirst({
    where: { slug, deleted_at: null, status: 'PUBLISHED', is_public: true },
    select: { title: true, description: true },
  });
  return {
    title: form?.title ?? 'Form',
    description: form?.description ?? undefined,
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await prisma.form.findFirst({
    where: { slug, deleted_at: null, is_public: true },
    include: { fields: { orderBy: { sort_order: 'asc' } } },
  });

  if (!form) notFound();

  if (form.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Form Not Available</h1>
          <p className="text-muted-foreground text-sm">
            {form.status === 'CLOSED'
              ? 'This form is closed and no longer accepting responses.'
              : 'This form is not currently accepting responses.'}
          </p>
        </div>
      </div>
    );
  }

  // Serialize dates for client
  const serialized = {
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    status: form.status,
    success_message: form.success_message,
    redirect_url: form.redirect_url,
    close_at: form.close_at?.toISOString() ?? null,
    submission_limit: form.submission_limit,
    close_on_limit: form.close_on_limit,
    fields: form.fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder,
      description: f.description,
      field_key: f.field_key,
      is_required: f.is_required,
      is_hidden: f.is_hidden,
      sort_order: f.sort_order,
      options: f.options,
      validations: f.validations,
      settings: f.settings,
    })),
  };

  return <PublicFormClient form={serialized} />;
}

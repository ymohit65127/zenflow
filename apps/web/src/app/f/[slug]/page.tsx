import { prisma } from "@zenflow/db";
import { PublicFormV2Client } from "@/app/forms/[slug]/_components/public-form-v2-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await prisma.form.findFirst({
    where: { slug, deleted_at: null },
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
    where: { slug, deleted_at: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include: { fields: { orderBy: { sort_order: 'asc' } } } as any,
  });

  if (!form) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formAny = form as any;

  if (form.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Form Not Available</h1>
          <p className="text-muted-foreground text-sm">
            {form.status === 'ARCHIVED'
              ? 'This form is closed and no longer accepting responses.'
              : 'This form is not currently accepting responses.'}
          </p>
        </div>
      </div>
    );
  }

  const serialized = {
    id: form.id,
    title: form.title,
    description: form.description ?? null,
    slug: form.slug,
    status: form.status,
    success_message: formAny.success_message ?? null,
    redirect_url: formAny.redirect_url ?? null,
    enable_window: formAny.enable_window ?? false,
    window_start: formAny.window_start?.toISOString() ?? null,
    window_end: formAny.window_end?.toISOString() ?? null,
    enable_max_submissions: formAny.enable_max_submissions ?? false,
    max_submissions: formAny.max_submissions ?? null,
    submissions_count: formAny.submissions_count ?? 0,
    enable_approval: formAny.enable_approval ?? false,
    recaptcha_site_key: formAny.recaptcha_site_key ?? null,
    public_rate_limit: formAny.public_rate_limit ?? null,
    custom_css: formAny.custom_css ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: (formAny.fields ?? []).map((f: any) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder ?? null,
      description: f.description ?? null,
      field_key: f.field_key,
      is_required: f.is_required,
      is_hidden: f.is_hidden,
      sort_order: f.sort_order,
      options: f.options ?? null,
      validations: f.validations ?? null,
      settings: f.settings ?? {},
      conditional: f.conditional ?? f.conditions ?? null,
      width: f.width ?? 'full',
      page_title: f.page_title ?? null,
    })),
  };

  return <PublicFormV2Client form={serialized} />;
}

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Star, Upload, Pen } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER'
  | 'DATE' | 'TIME' | 'DATETIME' | 'DROPDOWN' | 'MULTI_SELECT'
  | 'RADIO' | 'CHECKBOX' | 'FILE_UPLOAD' | 'RATING' | 'SCALE'
  | 'MATRIX' | 'DIVIDER' | 'HEADING' | 'PARAGRAPH' | 'SIGNATURE';

interface FieldOption {
  label: string;
  value: string;
}

interface PublicField {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string | null;
  description: string | null;
  field_key: string;
  is_required: boolean;
  is_hidden: boolean;
  sort_order: number;
  options: unknown;
  validations: unknown;
  settings: unknown;
}

interface PublicFormData {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  success_message: string | null;
  redirect_url: string | null;
  close_at: string | null;
  submission_limit: number | null;
  close_on_limit: boolean;
  fields: PublicField[];
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: PublicField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string | undefined;
}) {
  const options = (Array.isArray(field.options) ? field.options : []) as FieldOption[];

  const inputClass = cn(
    'w-full bg-background border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-colors',
    error
      ? 'border-red-400 focus:ring-red-400/30'
      : 'border-border focus:ring-brand-500/30 focus:border-brand-500'
  );

  switch (field.type) {
    case 'SHORT_TEXT':
    case 'EMAIL':
    case 'PHONE':
      return (
        <input
          type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          className={inputClass}
        />
      );

    case 'NUMBER':
      return (
        <input
          type="number"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          className={inputClass}
        />
      );

    case 'LONG_TEXT':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          rows={4}
          className={cn(inputClass, 'resize-none')}
        />
      );

    case 'DATE':
      return (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    case 'TIME':
      return (
        <input
          type="time"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    case 'DATETIME':
      return (
        <input
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    case 'DROPDOWN':
      return (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, 'appearance-none')}
        >
          <option value="">Select an option…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'RADIO':
      return (
        <div className="space-y-2.5">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                'w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                (value as string) === opt.value
                  ? 'border-brand-500 bg-brand-500'
                  : 'border-border group-hover:border-brand-500/50'
              )}>
                {(value as string) === opt.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <input
                type="radio"
                value={opt.value}
                checked={(value as string) === opt.value}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case 'CHECKBOX':
      return (
        <div className="space-y-2.5">
          {options.map((opt) => {
            const checked = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <div className={cn(
                  'w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  checked ? 'border-brand-500 bg-brand-500' : 'border-border group-hover:border-brand-500/50'
                )}>
                  {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={checked}
                  onChange={(e) => {
                    const curr = Array.isArray(value) ? (value as string[]) : [];
                    onChange(e.target.checked ? [...curr, opt.value] : curr.filter((v) => v !== opt.value));
                  }}
                  className="sr-only"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </div>
      );

    case 'MULTI_SELECT':
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const curr = Array.isArray(value) ? (value as string[]) : [];
                  onChange(selected ? curr.filter((v) => v !== opt.value) : [...curr, opt.value]);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  selected
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                    : 'border-border hover:border-brand-500/40'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case 'RATING': {
      const rating = Number(value) || 0;
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  'w-8 h-8 transition-colors',
                  star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
                )}
              />
            </button>
          ))}
        </div>
      );
    }

    case 'SCALE': {
      const scale = Number(value) || 0;
      return (
        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={10}
            value={scale || 5}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span className="font-medium text-brand-500">{scale || 5}</span>
            <span>10</span>
          </div>
        </div>
      );
    }

    case 'FILE_UPLOAD':
      return (
        <div className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center transition-colors',
          error ? 'border-red-400' : 'border-border hover:border-brand-500/40'
        )}>
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload or drag & drop
          </p>
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={() => onChange('file_uploaded')} />
        </div>
      );

    case 'SIGNATURE':
      return (
        <div className="border border-border rounded-xl p-4 flex flex-col items-center gap-2 bg-muted/20">
          <Pen className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signature capture (not available in preview)</p>
          <button
            type="button"
            onClick={() => onChange('signed')}
            className="text-xs text-brand-500 hover:underline"
          >
            Mark as signed
          </button>
        </div>
      );

    case 'DIVIDER':
      return <hr className="border-border" />;

    case 'HEADING':
      return <h3 className="text-lg font-semibold">{field.label}</h3>;

    case 'PARAGRAPH':
      return <p className="text-sm text-muted-foreground">{field.label}</p>;

    case 'MATRIX':
      return (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 text-center">
          Matrix field — configure rows and columns in the form builder
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          className={inputClass}
        />
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PublicFormClient({ form }: { form: PublicFormData }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = api.forms.submitPublic.useMutation({
    onSuccess: (res) => {
      setSubmitted(true);
      if (res.redirect_url) {
        setTimeout(() => {
          window.location.href = res.redirect_url!;
        }, 2000);
      }
    },
    onError: (e) => {
      setErrors({ _form: e.message });
    },
  });

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    form.fields.forEach((field) => {
      if (field.is_required && !field.is_hidden) {
        const val = formData[field.field_key];
        const isEmpty =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          newErrors[field.field_key] = `${field.label} is required`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate({
      slug: form.slug,
      data: formData as Record<string, string | number | boolean | string[] | null>,
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer || undefined : undefined,
    });
  }

  const visibleFields = form.fields.filter((f) => !f.is_hidden);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">
            {form.success_message ? '' : 'Thank you!'}
          </h1>
          <p className="text-muted-foreground">
            {form.success_message ?? 'Your response has been submitted successfully.'}
          </p>
          {form.redirect_url && (
            <p className="text-sm text-muted-foreground mt-3">Redirecting you shortly…</p>
          )}
        </div>
      </div>
    );
  }

  if (form.close_at && new Date() > new Date(form.close_at)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏰</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Form Closed</h1>
          <p className="text-muted-foreground text-sm">This form is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        {errors._form && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-xl text-sm text-red-600">
            {errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {visibleFields.map((field) => {
            if (field.type === 'DIVIDER') return <hr key={field.id} className="border-border" />;
            if (field.type === 'HEADING') return <h2 key={field.id} className="text-xl font-semibold pt-2">{field.label}</h2>;
            if (field.type === 'PARAGRAPH') return <p key={field.id} className="text-muted-foreground">{field.label}</p>;

            return (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-sm font-semibold">
                  {field.label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
                <FieldRenderer
                  field={field}
                  value={formData[field.field_key]}
                  onChange={(v) => setFormData((prev) => ({ ...prev, [field.field_key]: v }))}
                  error={errors[field.field_key] ?? undefined}
                />
                {errors[field.field_key] && (
                  <p className="text-xs text-red-500">{errors[field.field_key]}</p>
                )}
              </div>
            );
          })}

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Submitting…
                </span>
              ) : 'Submit'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by <span className="font-semibold">ZenFlow</span>
        </p>
      </div>
    </div>
  );
}

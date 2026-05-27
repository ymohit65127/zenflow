// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Star, Upload, Pen, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  evaluateConditionalRules,
  defaultFieldState,
  mergeRequiredState,
  type ConditionalRule,
} from '@/lib/form-conditional-logic';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER'
  | 'DATE' | 'TIME' | 'DATETIME' | 'DROPDOWN' | 'MULTI_SELECT'
  | 'RADIO' | 'CHECKBOX' | 'FILE_UPLOAD' | 'RATING' | 'SCALE'
  | 'MATRIX' | 'DIVIDER' | 'HEADING' | 'PARAGRAPH' | 'SIGNATURE'
  // v2 additions
  | 'input' | 'numeric' | 'textarea' | 'date' | 'datetime' | 'time'
  | 'file' | 'select' | 'radio' | 'checkbox' | 'button' | 'signature'
  | 'rating' | 'nps' | 'matrix' | 'repeater' | 'address' | 'phone'
  | 'payment' | 'hidden' | 'calculated' | 'pagebreak' | 'section'
  | 'richtext' | 'lookup';

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
  conditional?: unknown;
  width?: string;
  page_title?: string;
}

interface PublicFormData {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  success_message: string | null;
  redirect_url: string | null;
  enable_window: boolean;
  window_start: string | null;
  window_end: string | null;
  enable_max_submissions: boolean;
  max_submissions: number | null;
  submissions_count: number;
  enable_approval: boolean;
  recaptcha_site_key: string | null;
  public_rate_limit: number | null;
  custom_css: string | null;
  fields: PublicField[];
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: PublicField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  disabled?: boolean;
}) {
  const options = (Array.isArray(field.options) ? field.options : []) as FieldOption[];

  const inputClass = cn(
    'w-full bg-background border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-colors',
    error
      ? 'border-red-400 focus:ring-red-400/30'
      : 'border-border focus:ring-brand-500/30 focus:border-brand-500',
    disabled && 'opacity-50 cursor-not-allowed'
  );

  const type = field.type.toLowerCase();

  if (type === 'pagebreak' || type === 'section') return null;

  switch (type) {
    case 'short_text':
    case 'input':
    case 'email':
    case 'phone':
      return (
        <input
          type={type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          disabled={disabled}
          className={inputClass}
        />
      );

    case 'number':
    case 'numeric':
      return (
        <input
          type="number"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          disabled={disabled}
          className={inputClass}
        />
      );

    case 'long_text':
    case 'textarea':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          rows={4}
          disabled={disabled}
          className={cn(inputClass, 'resize-none')}
        />
      );

    case 'date':
      return (
        <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass} />
      );

    case 'time':
      return (
        <input type="time" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass} />
      );

    case 'datetime':
    case 'datetime-local':
      return (
        <input type="datetime-local" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass} />
      );

    case 'dropdown':
    case 'select':
      return (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(inputClass, 'appearance-none')}
        >
          <option value="">Select an option…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2.5">
          {options.map((opt) => (
            <label key={opt.value} className={cn('flex items-center gap-3 cursor-pointer group', disabled && 'opacity-50')}>
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                (value as string) === opt.value ? 'border-brand-500 bg-brand-500' : 'border-border group-hover:border-brand-500/50'
              )}>
                {(value as string) === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <input type="radio" value={opt.value} checked={(value as string) === opt.value} onChange={() => !disabled && onChange(opt.value)} className="sr-only" />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-2.5">
          {options.map((opt) => {
            const checked = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <label key={opt.value} className={cn('flex items-center gap-3 cursor-pointer group', disabled && 'opacity-50')}>
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  checked ? 'border-brand-500 bg-brand-500' : 'border-border group-hover:border-brand-500/50'
                )}>
                  {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={checked}
                  disabled={disabled}
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

    case 'multi_select':
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const curr = Array.isArray(value) ? (value as string[]) : [];
                  onChange(selected ? curr.filter((v) => v !== opt.value) : [...curr, opt.value]);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  selected ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-border hover:border-brand-500/40',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case 'rating': {
      const rating = Number(value) || 0;
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" disabled={disabled} onClick={() => onChange(star)} className={cn('transition-transform hover:scale-110', disabled && 'opacity-50')}>
              <Star className={cn('w-8 h-8 transition-colors', star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
            </button>
          ))}
        </div>
      );
    }

    case 'scale':
    case 'nps': {
      const scale = Number(value) || 0;
      const max = type === 'nps' ? 10 : 10;
      return (
        <div className="space-y-2">
          <input type="range" min={0} max={max} value={scale || 5} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="w-full accent-brand-500" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span className="font-medium text-brand-500">{scale || 5}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    case 'file_upload':
    case 'file':
      return (
        <div className={cn('border-2 border-dashed rounded-xl p-6 text-center relative transition-colors', error ? 'border-red-400' : 'border-border hover:border-brand-500/40')}>
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Click to upload or drag & drop</p>
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file.name);
            }}
          />
          {value && <p className="text-xs text-brand-500 mt-2 font-medium">{String(value)}</p>}
        </div>
      );

    case 'signature':
      return (
        <div className="border border-border rounded-xl p-4 flex flex-col items-center gap-2 bg-muted/20">
          <Pen className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signature capture</p>
          <button type="button" disabled={disabled} onClick={() => onChange('signed')} className="text-xs text-brand-500 hover:underline">
            {value === 'signed' ? 'Signed ✓' : 'Sign here'}
          </button>
        </div>
      );

    case 'divider':
      return <hr className="border-border" />;

    case 'heading':
      return <h3 className="text-lg font-semibold">{field.label}</h3>;

    case 'paragraph':
    case 'richtext':
      return <p className="text-sm text-muted-foreground">{field.label}</p>;

    case 'hidden':
      return null;

    case 'matrix':
      return (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 text-center">
          Matrix field — renders in full form renderer
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          disabled={disabled}
          className={inputClass}
        />
      );
  }
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 1 ? Math.round((current / total) * 100) : 100;
  return (
    <div className="space-y-1.5 mb-6">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Step {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PublicFormV2Client({ form }: { form: PublicFormData }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Inject custom CSS
  useEffect(() => {
    if (form.custom_css) {
      const style = document.createElement('style');
      style.textContent = form.custom_css;
      style.setAttribute('data-zenflow-form', form.id);
      document.head.appendChild(style);
      return () => { style.remove(); };
    }
  }, [form.custom_css, form.id]);

  // Compute field states via conditional logic engine
  const conditionalRules = useMemo<ConditionalRule[]>(() => {
    const rules: ConditionalRule[] = [];
    for (const field of form.fields) {
      if (field.conditional && typeof field.conditional === 'object') {
        // v2 ConditionalLogic format → convert to ConditionalRule[]
        const logic = field.conditional as {
          rules?: Array<{ field_name?: string; fieldId?: string; operator: string; value: unknown }>;
          action?: string;
        };
        if (Array.isArray(logic.rules)) {
          for (const r of logic.rules) {
            rules.push({
              if: {
                fieldId: r.fieldId ?? r.field_name ?? '',
                operator: r.operator as ConditionalRule['if']['operator'],
                value: r.value,
              },
              then: {
                action: (logic.action ?? 'show') as ConditionalRule['then']['action'],
                fieldIds: [field.id],
              },
            });
          }
        }
      }
    }
    return rules;
  }, [form.fields]);

  const fieldStates = useMemo(() => {
    const computed = evaluateConditionalRules(conditionalRules, formData);
    const result: Record<string, ReturnType<typeof defaultFieldState>> = {};
    for (const field of form.fields) {
      const compState = computed[field.id] ?? defaultFieldState();
      result[field.id] = mergeRequiredState(field.is_required, compState);
    }
    return result;
  }, [conditionalRules, formData, form.fields]);

  // Split fields into pages by pagebreak type
  const pages = useMemo(() => {
    const result: PublicField[][] = [[]];
    for (const field of form.fields) {
      if (field.type === 'pagebreak' || field.type === 'PAGEBREAK') {
        result.push([]);
      } else {
        result[result.length - 1]!.push(field);
      }
    }
    return result.filter((p) => p.length > 0);
  }, [form.fields]);

  const totalPages = pages.length;
  const currentFields = pages[currentPage] ?? [];

  const submitMutation = api.forms.submitPublic.useMutation({
    onSuccess: (res) => {
      if (form.enable_approval) {
        setApprovalPending(true);
      } else {
        setSubmitted(true);
        if (res.redirect_url) {
          setTimeout(() => { window.location.href = res.redirect_url!; }, 2000);
        }
      }
    },
    onError: (e) => {
      setErrors({ _form: e.message });
    },
  });

  // Check submission window
  const now = new Date();
  const windowClosed =
    form.enable_window &&
    form.window_end &&
    now > new Date(form.window_end);
  const windowNotOpen =
    form.enable_window &&
    form.window_start &&
    now < new Date(form.window_start);

  // Check max submissions
  const limitReached =
    form.enable_max_submissions &&
    form.max_submissions !== null &&
    form.submissions_count >= form.max_submissions;

  function validatePage(fields: PublicField[]): boolean {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const state = fieldStates[field.id] ?? defaultFieldState();
      if (!state.visible) continue;
      if (state.required || field.is_required) {
        const val = formData[field.field_key];
        const isEmpty =
          val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          newErrors[field.field_key] = `${field.label} is required`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (!validatePage(currentFields)) return;
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBack() {
    setCurrentPage((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePage(currentFields)) return;
    submitMutation.mutate({
      slug: form.slug,
      data: formData,
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      referrer: typeof window !== 'undefined' ? (document.referrer || undefined) : undefined,
    });
  }

  // ── Closed / limit states ──────────────────────────────────────────────────

  if (windowClosed) {
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

  if (windowNotOpen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock3 className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Not Open Yet</h1>
          <p className="text-muted-foreground text-sm">
            This form opens on {new Date(form.window_start!).toLocaleDateString()}.
          </p>
        </div>
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Submission Limit Reached</h1>
          <p className="text-muted-foreground text-sm">This form has reached its maximum number of responses.</p>
        </div>
      </div>
    );
  }

  // ── Approval pending state ─────────────────────────────────────────────────

  if (approvalPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
            <Clock3 className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Submitted — Awaiting Approval</h1>
          <p className="text-muted-foreground">
            {form.success_message ?? 'Your response has been submitted and is pending approval. You will be notified when it is reviewed.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Thank you!</h1>
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

  // ── Main form render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* reCAPTCHA site key hint (actual verification is server-side) */}
      {form.recaptcha_site_key && (
        <div className="hidden" data-sitekey={form.recaptcha_site_key} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        {/* Multi-page progress */}
        {totalPages > 1 && (
          <ProgressBar current={currentPage + 1} total={totalPages} />
        )}

        {/* Page title from pagebreak */}
        {totalPages > 1 && currentPage > 0 && (() => {
          // Find the nth pagebreak field to get its page_title
          let breakCount = 0;
          for (const f of form.fields) {
            if (f.type === 'pagebreak' || f.type === 'PAGEBREAK') {
              breakCount++;
              if (breakCount === currentPage && f.page_title) {
                return <h2 className="text-xl font-semibold mb-6">{f.page_title}</h2>;
              }
            }
          }
          return null;
        })()}

        {/* Form-level error */}
        {errors._form && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-xl text-sm text-red-600">
            {errors._form}
          </div>
        )}

        <form onSubmit={currentPage < totalPages - 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit} className="space-y-6">
          {currentFields.map((field) => {
            const state = fieldStates[field.id] ?? defaultFieldState();

            // Hidden by schema or conditional logic
            if (field.is_hidden || !state.visible) return null;

            // Layout-only fields
            if (['divider', 'DIVIDER'].includes(field.type)) {
              return <hr key={field.id} className="border-border" />;
            }
            if (['heading', 'HEADING'].includes(field.type)) {
              return <h2 key={field.id} className="text-xl font-semibold pt-2">{field.label}</h2>;
            }
            if (['paragraph', 'PARAGRAPH', 'richtext', 'section'].includes(field.type)) {
              return <p key={field.id} className="text-muted-foreground">{field.label}</p>;
            }
            if (['hidden'].includes(field.type)) return null;

            const isRequired = state.required || field.is_required;
            const isDisabled = state.disabled;

            return (
              <div
                key={field.id}
                className={cn(
                  'space-y-1.5',
                  field.width === 'half' && 'sm:col-span-1',
                  field.width === 'third' && 'sm:col-span-1'
                )}
              >
                <label className="block text-sm font-semibold">
                  {field.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
                <FieldRenderer
                  field={field}
                  value={formData[field.field_key]}
                  onChange={(v) => setFormData((prev) => ({ ...prev, [field.field_key]: v }))}
                  error={errors[field.field_key] ?? undefined}
                  disabled={isDisabled}
                />
                {errors[field.field_key] && (
                  <p className="text-xs text-red-500">{errors[field.field_key]}</p>
                )}
              </div>
            );
          })}

          {/* Navigation */}
          <div className="pt-4 flex items-center gap-3">
            {currentPage > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Submitting…
                </>
              ) : currentPage < totalPages - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
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

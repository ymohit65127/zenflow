// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Settings, Bell, GitBranch, Webhook, Key, Shield,
  Plus, Trash2, Save, Eye, EyeOff, Copy, RefreshCw, Loader2,
} from 'lucide-react';

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = 'general' | 'notifications' | 'approvals' | 'webhooks' | 'api' | 'advanced';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'approvals', label: 'Approvals', icon: GitBranch },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'api', label: 'API', icon: Key },
  { id: 'advanced', label: 'Advanced', icon: Shield },
];

// ─── Input helpers ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>;
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-brand-500 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
      </label>
    </div>
  );
}

// ─── Tab panels ──────────────────────────────────────────────────────────────

function GeneralTab({
  form,
  onSave,
  saving,
}: {
  form: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(String(form.title ?? ''));
  const [description, setDescription] = useState(String(form.description ?? ''));
  const [redirectUrl, setRedirectUrl] = useState(String(form.redirect_url ?? ''));
  const [successMessage, setSuccessMessage] = useState(String(form.success_message ?? ''));
  const [enableWindow, setEnableWindow] = useState(Boolean(form.enable_window));
  const [windowStart, setWindowStart] = useState(String(form.window_start ?? ''));
  const [windowEnd, setWindowEnd] = useState(String(form.window_end ?? ''));
  const [enableMax, setEnableMax] = useState(Boolean(form.enable_max_submissions));
  const [maxSubmissions, setMaxSubmissions] = useState(String(form.max_submissions ?? ''));

  useEffect(() => {
    setTitle(String(form.title ?? ''));
    setDescription(String(form.description ?? ''));
    setRedirectUrl(String(form.redirect_url ?? ''));
    setSuccessMessage(String(form.success_message ?? ''));
  }, [form]);

  function handleSave() {
    onSave({
      title,
      description: description || undefined,
      redirect_url: redirectUrl || undefined,
      success_message: successMessage || undefined,
      enable_window: enableWindow,
      window_start: windowStart ? new Date(windowStart).toISOString() : undefined,
      window_end: windowEnd ? new Date(windowEnd).toISOString() : undefined,
      enable_max_submissions: enableMax,
      max_submissions: maxSubmissions ? Number(maxSubmissions) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Form Title</Label>
        <Input value={title} onChange={setTitle} placeholder="Enter form title" />
      </div>
      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional description shown to users"
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>
      <div>
        <Label>Success Message</Label>
        <textarea
          value={successMessage}
          onChange={(e) => setSuccessMessage(e.target.value)}
          rows={2}
          placeholder="Thank you for your submission!"
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>
      <div>
        <Label>Redirect URL (after submit)</Label>
        <Input value={redirectUrl} onChange={setRedirectUrl} placeholder="https://example.com/thank-you" type="url" />
      </div>

      <div className="border-t border-border pt-4 space-y-1 divide-y divide-border">
        <Toggle checked={enableWindow} onChange={setEnableWindow} label="Submission Window" description="Only accept submissions between specific dates" />
        {enableWindow && (
          <div className="grid grid-cols-2 gap-4 py-3">
            <div>
              <Label>Opens At</Label>
              <Input value={windowStart} onChange={setWindowStart} type="datetime-local" />
            </div>
            <div>
              <Label>Closes At</Label>
              <Input value={windowEnd} onChange={setWindowEnd} type="datetime-local" />
            </div>
          </div>
        )}
        <Toggle checked={enableMax} onChange={setEnableMax} label="Limit Submissions" description="Stop accepting after a maximum number of submissions" />
        {enableMax && (
          <div className="py-3">
            <Label>Maximum Submissions</Label>
            <Input value={maxSubmissions} onChange={setMaxSubmissions} placeholder="100" type="number" />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </button>
    </div>
  );
}

function NotificationsTab({
  form,
  onSave,
  saving,
}: {
  form: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [enableEmail, setEnableEmail] = useState(Boolean(form.enable_email_notification));
  const [notifyAdminEmails, setNotifyAdminEmails] = useState<string[]>(
    Array.isArray(form.notify_admin_emails) ? (form.notify_admin_emails as string[]) : []
  );
  const [newEmail, setNewEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState(String(form.notify_email_subject ?? ''));
  const [emailBody, setEmailBody] = useState(String(form.notify_email_body ?? ''));

  function addEmail() {
    const trimmed = newEmail.trim();
    if (trimmed && !notifyAdminEmails.includes(trimmed)) {
      setNotifyAdminEmails([...notifyAdminEmails, trimmed]);
    }
    setNewEmail('');
  }

  function removeEmail(email: string) {
    setNotifyAdminEmails(notifyAdminEmails.filter((e) => e !== email));
  }

  return (
    <div className="space-y-6">
      <Toggle
        checked={enableEmail}
        onChange={setEnableEmail}
        label="Email Notifications"
        description="Send an email when a new submission is received"
      />
      {enableEmail && (
        <>
          <div>
            <Label>Notify These Emails</Label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                placeholder="admin@example.com"
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
              <button
                onClick={addEmail}
                className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {notifyAdminEmails.map((email) => (
                <span
                  key={email}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-500/10 text-brand-600 rounded-full text-xs font-medium"
                >
                  {email}
                  <button onClick={() => removeEmail(email)} className="hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <Label>Email Subject</Label>
            <Input value={emailSubject} onChange={setEmailSubject} placeholder="New form submission: {form_title}" />
          </div>
          <div>
            <Label>Email Body (Mustache template)</Label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              placeholder="Hello,&#10;&#10;A new submission was received for {{form_title}}.&#10;&#10;Submitted by: {{submitter_name}}"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available variables: {'{form_title}'}, {'{submitter_name}'}, {'{submission_id}'}, {'{submitted_at}'}
            </p>
          </div>
        </>
      )}
      <button
        onClick={() =>
          onSave({
            enable_email_notification: enableEmail,
            notify_admin_emails: notifyAdminEmails,
            notify_email_subject: emailSubject || undefined,
            notify_email_body: emailBody || undefined,
          })
        }
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </button>
    </div>
  );
}

function ApprovalsTab({ formId }: { formId: string }) {
  const stepsQuery = api.forms.approvals.listSteps.useQuery({ formId });
  const addStep = api.forms.approvals.addStep.useMutation({
    onSuccess: () => { void stepsQuery.refetch(); toast.success('Step added'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteStep = api.forms.approvals.deleteStep.useMutation({
    onSuccess: () => { void stepsQuery.refetch(); toast.success('Step removed'); },
    onError: (e) => toast.error(e.message),
  });

  const steps = stepsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure multi-step approval workflow. Approvers are notified in order.
        Any approver can reject at any step.
      </p>

      {stepsQuery.isLoading ? (
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
      ) : steps.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
          No approval steps configured. Add a step below.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step: Record<string, unknown>, i: number) => (
            <div key={step.id as string} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl">
              <span className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium capitalize">{String(step.approver_type)}</p>
                {step.approver_id && <p className="text-xs text-muted-foreground">{String(step.approver_id)}</p>}
                {step.approver_role && <p className="text-xs text-muted-foreground">Role: {String(step.approver_role)}</p>}
                {step.notification_email && <p className="text-xs text-muted-foreground">{String(step.notification_email)}</p>}
              </div>
              <button
                onClick={() => deleteStep.mutate({ id: step.id as string })}
                className="w-7 h-7 rounded-lg hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddStepForm
        formId={formId}
        nextPosition={steps.length + 1}
        onAdd={(data) => addStep.mutate(data)}
        adding={addStep.isPending}
      />
    </div>
  );
}

function AddStepForm({
  formId,
  nextPosition,
  onAdd,
  adding,
}: {
  formId: string;
  nextPosition: number;
  onAdd: (data: { formId: string; position: number; approver_type: 'user' | 'role' | 'manager'; approver_id?: string; approver_role?: string; notification_email?: string }) => void;
  adding: boolean;
}) {
  const [approverType, setApproverType] = useState<'user' | 'role' | 'manager'>('user');
  const [approverId, setApproverId] = useState('');
  const [approverRole, setApproverRole] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');

  function handleAdd() {
    onAdd({
      formId,
      position: nextPosition,
      approver_type: approverType,
      approver_id: approverId || undefined,
      approver_role: approverRole || undefined,
      notification_email: notificationEmail || undefined,
    });
    setApproverId('');
    setApproverRole('');
    setNotificationEmail('');
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Approval Step</p>
      <div className="grid grid-cols-3 gap-2">
        {(['user', 'role', 'manager'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setApproverType(t)}
            className={cn(
              'py-2 rounded-lg text-xs font-medium border transition-colors',
              approverType === t ? 'bg-brand-500/10 border-brand-500 text-brand-600' : 'border-border hover:bg-muted'
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {approverType === 'user' && (
        <Input value={approverId} onChange={setApproverId} placeholder="User ID or email" />
      )}
      {approverType === 'role' && (
        <Input value={approverRole} onChange={setApproverRole} placeholder="Role name (e.g. manager)" />
      )}
      <Input value={notificationEmail} onChange={setNotificationEmail} placeholder="Notification email (optional)" type="email" />
      <button
        onClick={handleAdd}
        disabled={adding}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add Step
      </button>
    </div>
  );
}

function WebhooksTab({
  formId,
  webhookUrl,
  webhookSecret,
  onSave,
  saving,
}: {
  formId: string;
  webhookUrl: string;
  webhookSecret: string;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [url, setUrl] = useState(webhookUrl);
  const [secret, setSecret] = useState(webhookSecret);
  const [showSecret, setShowSecret] = useState(false);
  const queueQuery = api.forms.webhooks.queueStatus.useQuery({ formId, limit: 10, offset: 0 });

  const testMutation = api.forms.webhooks.testFire.useMutation({
    onSuccess: (res) => {
      if (res.success) toast.success(`Test webhook delivered (HTTP ${res.status})`);
      else toast.error(`Test webhook failed (HTTP ${res.status})`);
    },
    onError: (e) => toast.error(e.message),
  });

  const retryMutation = api.forms.webhooks.retry.useMutation({
    onSuccess: () => { toast.success('Retried'); void queueQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const entries = queueQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Label>Webhook URL</Label>
        <Input value={url} onChange={setUrl} placeholder="https://your-server.com/webhook" type="url" />
      </div>
      <div>
        <Label>Signing Secret</Label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Your HMAC-SHA256 secret"
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Sent as <code className="font-mono">X-ZenFlow-Signature: sha256=&lt;hex&gt;</code>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ webhook_url: url || undefined, webhook_secret: secret || undefined })}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
        <button
          onClick={() => testMutation.mutate({ formId })}
          disabled={testMutation.isPending || !url}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors disabled:opacity-60"
        >
          {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Test Fire
        </button>
      </div>

      {/* Delivery log */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Deliveries</p>
        {queueQuery.isLoading ? (
          <div className="h-16 bg-muted rounded-xl animate-pulse" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook deliveries yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry: Record<string, unknown>) => (
              <div key={entry.id as string} className="flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-xl text-xs">
                <span className={cn(
                  'px-2 py-0.5 rounded-full font-medium',
                  entry.status === 'delivered' ? 'bg-green-500/10 text-green-600' :
                  entry.status === 'failed' ? 'bg-red-500/10 text-red-600' :
                  'bg-amber-500/10 text-amber-600'
                )}>
                  {String(entry.status)}
                </span>
                <span className="text-muted-foreground flex-1 truncate">
                  {String(entry.webhook_url)}
                </span>
                <span className="text-muted-foreground">×{String(entry.attempts)}</span>
                {entry.status === 'failed' && (
                  <button
                    onClick={() => retryMutation.mutate({ queueId: entry.id as string })}
                    className="text-brand-500 hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApiTab({ formId }: { formId: string }) {
  const [newLabel, setNewLabel] = useState('');
  const [newScope, setNewScope] = useState<'read' | 'read_approve'>('read');
  const [lastCreated, setLastCreated] = useState<{ id: string; raw_token: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const tokensQuery = api.forms.apiTokens.list.useQuery({ formId });
  const createToken = api.forms.apiTokens.create.useMutation({
    onSuccess: (data) => {
      void tokensQuery.refetch();
      setLastCreated({ id: data.id, raw_token: data.raw_token, label: data.label });
      setNewLabel('');
      toast.success('API token created');
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeToken = api.forms.apiTokens.revoke.useMutation({
    onSuccess: () => { void tokensQuery.refetch(); toast.success('Token revoked'); },
    onError: (e) => toast.error(e.message),
  });

  const tokens = tokensQuery.data ?? [];
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function copyToken() {
    if (lastCreated) {
      void navigator.clipboard.writeText(lastCreated.raw_token).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">API Endpoint</p>
        <code className="text-xs font-mono break-all text-foreground">
          {appUrl}/api/forms/[slug]/submissions
        </code>
        <p className="text-xs text-muted-foreground">
          Authenticate with: <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>
        </p>
      </div>

      {/* Show new token once */}
      {lastCreated && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-green-700">
            Token created: {lastCreated.label}
          </p>
          <p className="text-xs text-green-600 font-mono break-all">{lastCreated.raw_token}</p>
          <p className="text-xs text-amber-600 font-medium">
            Copy this token now — it will not be shown again.
          </p>
          <button
            onClick={copyToken}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy Token'}
          </button>
        </div>
      )}

      {/* Token list */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Active Tokens</p>
        {tokensQuery.isLoading ? (
          <div className="h-12 bg-muted rounded-xl animate-pulse" />
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token: Record<string, unknown>) => (
              <div key={token.id as string} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium">{String(token.label)}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    zf_{String(token.token_prefix)}_…&nbsp;·&nbsp;
                    <span className="capitalize">{String(token.scope)}</span>
                  </p>
                </div>
                <button
                  onClick={() => revokeToken.mutate({ id: token.id as string })}
                  className="px-2.5 py-1 text-xs rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors font-medium"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate new token */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generate Token</p>
        <Input value={newLabel} onChange={setNewLabel} placeholder="Token label (e.g. Zapier integration)" />
        <div className="grid grid-cols-2 gap-2">
          {(['read', 'read_approve'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setNewScope(s)}
              className={cn(
                'py-2 rounded-lg text-xs font-medium border transition-colors',
                newScope === s ? 'bg-brand-500/10 border-brand-500 text-brand-600' : 'border-border hover:bg-muted'
              )}
            >
              {s === 'read' ? 'Read Only' : 'Read + Approve'}
            </button>
          ))}
        </div>
        <button
          onClick={() => createToken.mutate({ formId, label: newLabel, scope: newScope })}
          disabled={createToken.isPending || !newLabel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {createToken.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Generate Token
        </button>
      </div>
    </div>
  );
}

function AdvancedTab({
  form,
  onSave,
  saving,
}: {
  form: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(Boolean(form.recaptcha_site_key));
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(String(form.recaptcha_site_key ?? ''));
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(String(form.recaptcha_secret_key ?? ''));
  const [minScore, setMinScore] = useState(String(form.recaptcha_min_score ?? '0.5'));
  const [rateLimit, setRateLimit] = useState(String(form.public_rate_limit ?? ''));
  const [customCss, setCustomCss] = useState(String(form.custom_css ?? ''));

  return (
    <div className="space-y-6">
      <div className="space-y-1 divide-y divide-border">
        <Toggle
          checked={recaptchaEnabled}
          onChange={setRecaptchaEnabled}
          label="Enable reCAPTCHA v3"
          description="Protects public forms from spam and bots"
        />
        {recaptchaEnabled && (
          <div className="py-4 space-y-3">
            <div>
              <Label>Site Key</Label>
              <Input value={recaptchaSiteKey} onChange={setRecaptchaSiteKey} placeholder="6Lc…" />
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input value={recaptchaSecretKey} onChange={setRecaptchaSecretKey} placeholder="6Lc…" type="password" />
            </div>
            <div>
              <Label>Minimum Score (0.0 – 1.0)</Label>
              <Input value={minScore} onChange={setMinScore} placeholder="0.5" type="number" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Rate Limiting (max submissions per hour per IP)</Label>
        <Input value={rateLimit} onChange={setRateLimit} placeholder="e.g. 5" type="number" />
        <p className="text-xs text-muted-foreground mt-1">Leave blank to disable rate limiting.</p>
      </div>

      <div>
        <Label>Custom CSS</Label>
        <textarea
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={8}
          placeholder=".zenflow-form { font-family: 'Inter', sans-serif; }"
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>

      <button
        onClick={() =>
          onSave({
            recaptcha_site_key: recaptchaEnabled ? recaptchaSiteKey || undefined : null,
            recaptcha_secret_key: recaptchaEnabled ? recaptchaSecretKey || undefined : null,
            recaptcha_min_score: recaptchaEnabled && minScore ? Number(minScore) : undefined,
            public_rate_limit: rateLimit ? Number(rateLimit) : null,
            custom_css: customCss || null,
          })
        }
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FormSettingsPage() {
  const params = useParams<{ id: string }>();
  const formId = params.id;
  const router = useRouter();
  const utils = api.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>('general');

  const formQuery = api.forms.get.useQuery({ id: formId });
  const updateForm = api.forms.update.useMutation({
    onSuccess: () => {
      toast.success('Settings saved');
      void utils.forms.get.invalidate({ id: formId });
    },
    onError: (e) => toast.error(e.message),
  });

  const form = (formQuery.data ?? {}) as Record<string, unknown>;

  // Webhook configure mutation
  const configureWebhook = api.forms.webhooks.configure.useMutation({
    onSuccess: () => {
      toast.success('Webhook configuration saved');
      void utils.forms.get.invalidate({ id: formId });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSave(data: Record<string, unknown>) {
    updateForm.mutate({ id: formId, ...data });
  }

  function handleWebhookSave(data: Record<string, unknown>) {
    configureWebhook.mutate({
      formId,
      webhook_url: data.webhook_url as string | undefined,
      webhook_secret: data.webhook_secret as string | undefined,
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/forms')}
          className="w-9 h-9 rounded-xl border border-border hover:bg-muted flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Form Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {formQuery.isLoading ? 'Loading…' : (form.title as string) ?? 'Untitled Form'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Tab sidebar */}
        <nav className="flex sm:flex-col gap-1 flex-shrink-0 sm:w-44">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full',
                activeTab === tab.id
                  ? 'bg-brand-500/10 text-brand-600'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 min-w-0">
          {formQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <GeneralTab form={form} onSave={handleSave} saving={updateForm.isPending} />
              )}
              {activeTab === 'notifications' && (
                <NotificationsTab form={form} onSave={handleSave} saving={updateForm.isPending} />
              )}
              {activeTab === 'approvals' && <ApprovalsTab formId={formId} />}
              {activeTab === 'webhooks' && (
                <WebhooksTab
                  formId={formId}
                  webhookUrl={String(form.webhook_url ?? '')}
                  webhookSecret={String(form.webhook_secret ?? '')}
                  onSave={handleWebhookSave}
                  saving={configureWebhook.isPending}
                />
              )}
              {activeTab === 'api' && <ApiTab formId={formId} />}
              {activeTab === 'advanced' && (
                <AdvancedTab form={form} onSave={handleSave} saving={updateForm.isPending} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

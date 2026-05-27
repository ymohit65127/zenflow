/**
 * Forms v2 — Webhook Dispatcher Utility
 *
 * Signs the payload with HMAC-SHA256 and dispatches it to the configured webhook URL.
 * The X-ZenFlow-Signature header uses the sha256=<hex> format (same as GitHub webhooks).
 */

import crypto from 'crypto';

export interface WebhookDispatchResult {
  success: boolean;
  status: number;
  error?: string;
}

/**
 * Dispatch a signed webhook payload to a URL.
 *
 * @param webhookUrl  Destination URL
 * @param secret      HMAC signing secret (empty string = no signature header)
 * @param payload     Object to send as JSON body
 * @param deliveryId  Optional delivery ID for the X-ZenFlow-Delivery header
 */
export async function dispatchWebhook(
  webhookUrl: string,
  secret: string,
  payload: object,
  deliveryId?: string
): Promise<WebhookDispatchResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-ZenFlow-Delivery': deliveryId ?? `zf-${Date.now()}`,
    'User-Agent': 'ZenFlow-Webhook/2.0',
  };

  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-ZenFlow-Signature'] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, status: 0, error: message };
  }
}

/**
 * Build a standard ZenFlow webhook payload envelope.
 */
export function buildWebhookPayload(
  event: 'on_submit' | 'on_approve' | 'on_reject' | 'test',
  formId: string,
  formTitle: string,
  submissionId?: string,
  data?: Record<string, unknown>
): object {
  return {
    event,
    form_id: formId,
    form_title: formTitle,
    submission_id: submissionId ?? null,
    timestamp: new Date().toISOString(),
    data: data ?? {},
  };
}

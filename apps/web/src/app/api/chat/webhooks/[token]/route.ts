import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zenflow/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const webhook = await prisma.chatIncomingWebhook.findFirst({
    where: { token, is_active: true },
  });

  if (!webhook) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content = (body.text as string) ?? (body.content as string);
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: "'text' or 'content' field is required" }, { status: 400 });
  }

  const message = await prisma.chatMessageV2.create({
    data: {
      channel_id: webhook.channel_id,
      user_id: webhook.created_by,
      content: content.trim(),
      message_type: 'system',
      metadata: {
        webhook_name: webhook.username ?? webhook.name,
        icon_url: webhook.icon_url ?? null,
        source: 'incoming_webhook',
      } as object,
    },
  });

  // Update webhook stats
  await prisma.chatIncomingWebhook.update({
    where: { id: webhook.id },
    data: { post_count: { increment: 1 }, last_used_at: new Date() },
  });

  // Attempt real-time push (no-op if socket server isn't running)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSocket } = require('@/lib/socket-client') as typeof import('@/lib/socket-client');
    const socket = getSocket();
    socket.emit('new_message', message);
  } catch {
    // Socket not available in API routes — client will pick up via polling
  }

  return NextResponse.json({ ok: true, message_id: message.id });
}

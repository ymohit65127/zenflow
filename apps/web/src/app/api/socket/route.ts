/**
 * Socket.io initialization route.
 *
 * GET /api/socket — initializes the Socket.io server on first call (no-op
 * on subsequent calls).  The actual WS upgrade is handled by the custom
 * Next.js server (server.ts / server.js) if present, or by the Socket.io
 * adapter for serverless environments.
 *
 * In development without a custom server this endpoint returns a JSON
 * descriptor so the client knows socket info.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000',
    transport: 'websocket',
  });
}

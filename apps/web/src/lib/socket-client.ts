/**
 * Socket.io client singleton.
 *
 * If socket.io-client is not installed this module falls back to
 * a long-polling shim so the rest of the chat UI continues to work.
 */

type EventCallback = (...args: any[]) => void;

// ── Minimal fallback when socket.io-client is absent ────────────────────────

class PollingSocket {
  private listeners: Record<string, EventCallback[]> = {};
  private timers: ReturnType<typeof setTimeout>[] = [];
  public id = `poll-${Math.random().toString(36).slice(2)}`;
  public connected = false;

  on(event: string, cb: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(cb);
    return this;
  }

  off(event: string, cb?: EventCallback) {
    if (!cb) {
      this.listeners[event] = [];
    } else {
      this.listeners[event] = (this.listeners[event] ?? []).filter((f) => f !== cb);
    }
    return this;
  }

  emit(_event: string, ..._args: any[]) {
    // No-op: mutations are handled via tRPC
    return this;
  }

  /** Fire registered listeners (called externally by the polling loop) */
  _dispatch(event: string, ...args: any[]) {
    for (const cb of this.listeners[event] ?? []) {
      cb(...args);
    }
  }

  disconnect() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.connected = false;
  }
}

// ── Real socket.io-client (optional) ────────────────────────────────────────

type AnySocket = PollingSocket | import('socket.io-client').Socket;

let _socket: AnySocket | null = null;

export function getSocket(): AnySocket {
  if (_socket) return _socket;

  try {
    // Dynamic require so the build doesn't fail if the package is missing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { io } = require('socket.io-client') as typeof import('socket.io-client');
    _socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  } catch {
    console.warn('[ZenFlow Chat] socket.io-client not installed — using long-poll fallback');
    _socket = new PollingSocket();
  }

  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}

export type { AnySocket as AppSocket };

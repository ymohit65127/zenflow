// IMPORTANT: Always use { redirect: 'manual' } when calling fetch() after assertSafeUrl
/**
 * SSRF Guard — shared utility for blocking requests to private/internal addresses.
 * Import assertSafeUrl and call it before any outbound fetch that uses user-supplied URLs.
 * Prefer safeFetch() which enforces redirect: 'manual' automatically.
 */

import dns from 'dns/promises';

const PRIVATE_RANGES = [
  /^127\./,                              // Loopback
  /^10\./,                               // Class A private
  /^192\.168\./,                         // Class C private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // Class B private
  /^169\.254\./,                         // Link-local (AWS metadata)
  /^100\.64\./,                          // CGNAT
  /^0\./,                                // Current network
  /^fc[0-9a-f]{2}:/i,                   // IPv6 ULA
  /^fe[89ab][0-9a-f]:/i,                // IPv6 link-local
];

const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data', // AWS alt metadata hostname
]);

/**
 * Asserts that a URL is safe to fetch — i.e. not pointing at a private/internal
 * address. Throws an Error with an SSRF_BLOCKED prefix if the URL is unsafe.
 *
 * @param url  The user-supplied webhook or HTTP URL to validate.
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS webhook URLs are allowed in production.');
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`SSRF_BLOCKED: Protocol '${parsed.protocol}' is not allowed.`);
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(`SSRF_BLOCKED: Host '${host}' is not allowed.`);
  }

  if (PRIVATE_RANGES.some((r) => r.test(host))) {
    throw new Error(`SSRF_BLOCKED: Private IP range '${host}' is not allowed.`);
  }

  // IPv6-mapped IPv4 — e.g. [::ffff:127.0.0.1] or ::ffff:192.168.1.1
  const ipv6MappedMatch = host.match(/^\[?::ffff:(\d+\.\d+\.\d+\.\d+)\]?$/i);
  if (ipv6MappedMatch) {
    const embeddedIp = ipv6MappedMatch[1]!;
    if (PRIVATE_RANGES.some((r) => r.test(embeddedIp)) || BLOCKED_HOSTS.has(embeddedIp)) {
      throw new Error(`SSRF_BLOCKED: IPv6-mapped private address '${host}' is not allowed.`);
    }
  }

  // Decimal-encoded IP — e.g. http://2130706433/ → 127.0.0.1
  if (/^\d+$/.test(host)) {
    const n = parseInt(host, 10);
    if (!isNaN(n) && n >= 0 && n <= 0xFFFFFFFF) {
      const ip = [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF].join('.');
      if (PRIVATE_RANGES.some((r) => r.test(ip)) || BLOCKED_HOSTS.has(ip)) {
        throw new Error(`SSRF_BLOCKED: Decimal-encoded private address '${host}' (${ip}) is not allowed.`);
      }
    }
  }

  // Octal-encoded IP — e.g. http://0177.0.0.1/ → 127.0.0.1
  const octets = host.split('.');
  if (
    octets.length === 4 &&
    octets.every((o) => /^[0-7]+$/.test(o)) &&
    octets.some((o) => o.startsWith('0') && o.length > 1)
  ) {
    const ip = octets.map((o) => parseInt(o, 8)).join('.');
    if (PRIVATE_RANGES.some((r) => r.test(ip)) || BLOCKED_HOSTS.has(ip)) {
      throw new Error(`SSRF_BLOCKED: Octal-encoded private address '${host}' (${ip}) is not allowed.`);
    }
  }

  // DNS resolution check — ensures hostnames that resolve to private IPs are also blocked
  try {
    const addrs = await dns.lookup(host, { all: true });
    for (const { address } of addrs) {
      if (PRIVATE_RANGES.some((r) => r.test(address))) {
        throw new Error(`SSRF_BLOCKED: '${host}' resolves to private IP '${address}'.`);
      }
      if (BLOCKED_HOSTS.has(address)) {
        throw new Error(`SSRF_BLOCKED: '${host}' resolves to blocked address '${address}'.`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('SSRF_BLOCKED')) throw err;
    throw new Error(`DNS resolution failed for '${host}': ${msg}`);
  }
}

/**
 * Safe fetch wrapper — validates the URL with assertSafeUrl and blocks HTTP redirects
 * to prevent redirect-based SSRF bypasses.
 *
 * Use this instead of calling assertSafeUrl + fetch separately.
 */
export async function safeFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  await assertSafeUrl(url);
  const res = await fetch(url, { ...opts, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`SSRF_BLOCKED: redirect to ${res.headers.get('location') ?? 'unknown'}`);
  }
  return res;
}

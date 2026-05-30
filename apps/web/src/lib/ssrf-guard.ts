/**
 * SSRF Guard — shared utility for blocking requests to private/internal addresses.
 * Import assertSafeUrl and call it before any outbound fetch that uses user-supplied URLs.
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

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/api/auth"];
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // --- Nonce + CSP ---
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  // Build forwarded request headers that carry the nonce
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', cspHeader);

  // Allow public API routes
  if (pathname.startsWith("/api/auth")) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('content-security-policy', cspHeader);
    res.headers.set('x-nonce', nonce);
    return res;
  }
  // Allow public form embed routes (moved to /f/ to avoid route conflicts)
  if (pathname.startsWith("/f/")) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('content-security-policy', cspHeader);
    res.headers.set('x-nonce', nonce);
    return res;
  }
  // Allow public pages
  if (pathname.startsWith("/demo") || pathname.startsWith("/contact")) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('content-security-policy', cspHeader);
    res.headers.set('x-nonce', nonce);
    return res;
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect root to dashboard if logged in
  if (isAuthenticated && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protect dashboard routes
  if (!isAuthenticated && !publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    const loginUrl = new URL("/login", req.url);
    // Only set callbackUrl if it's a safe relative path
    const isRelativePath = pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes(':');
    if (isRelativePath) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

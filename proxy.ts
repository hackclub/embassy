import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isAuthBypassEnabled } from "@/lib/bypass";

// Security headers are owned by Caddy in production (infra/nix/services.nix).
// This proxy only handles request IDs and auth redirects.

// Page prefixes that anonymous visitors may access. Everything else requires
// a session (unless ADMIN_BYPASS is enabled). Note: "/" is matched exactly,
// not by prefix — a "/" entry here would make every path public.
const PUBLIC_PATHS = [
  // APIs handle their own authentication (API keys, 401 JSON, rate limits) —
  // redirecting them to the sign-in page would break programmatic clients.
  "/api/auth",
  "/api/health",
  "/api/feedback",
  "/api/orders",
  // Public pages
  "/faq",
  "/how-it-works",
  "/submit",
  "/vote",
  "/track",
  "/recipient",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

// Static assets served from /public are intended to be public (logo, icons).
const STATIC_ASSET_PATTERN = /\.(png|jpe?g|gif|svg|ico|webp|avif|css|js|map|txt|xml|json|woff2?|otf|ttf|eot)$/i;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (STATIC_ASSET_PATTERN.test(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  const { pathname } = request.nextUrl;

  if (!isPublicPath(pathname) && !isAuthBypassEnabled()) {
    const session = await auth();
    if (!session?.user) {
      const signInUrl = new URL("/api/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
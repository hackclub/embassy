import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isAuthBypassEnabled } from "@/lib/bypass";

// matched per path segment (not raw prefix), so "/track" won't match "/trackable-admin"
const PUBLIC_PATHS = [
  // APIs do their own auth (keys, 401 JSON, rate limits)
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

// static assets in /public are meant to be public
const STATIC_ASSET_PATTERN = /\.(png|jpe?g|gif|svg|ico|webp|avif|css|js|map|txt|xml|json|woff2?|otf|ttf|eot)$/i;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // API routes never fall back to the extension whitelist.
  if (pathname.startsWith("/api/")) return false;
  return STATIC_ASSET_PATTERN.test(pathname);
}

export async function proxy(request: NextRequest) {
  const inbound = request.headers.get("x-request-id");
  const requestId = inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();
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

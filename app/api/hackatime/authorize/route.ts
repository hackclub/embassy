import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/org";
import { buildAuthorizeUrl, HACKATIME_STATE_COOKIE, isHackatimeConfigured } from "@/lib/hackatime";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", request.url)
    );
  }

  if (!isHackatimeConfigured()) {
    return NextResponse.redirect(new URL("/me?hackatime=unconfigured", request.url));
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const res = NextResponse.redirect(buildAuthorizeUrl(origin, state));
  res.cookies.set(HACKATIME_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: requestUrl.protocol === "https:",
  });
  return res;
}

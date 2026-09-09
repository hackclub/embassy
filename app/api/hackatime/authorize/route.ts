import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/org";
import { buildAuthorizeUrl, getBaseUrl, HACKATIME_STATE_COOKIE, isHackatimeConfigured } from "@/lib/hackatime";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", getBaseUrl())
    );
  }

  if (!isHackatimeConfigured()) {
    return NextResponse.redirect(new URL("/me?hackatime=unconfigured", getBaseUrl()));
  }

  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(HACKATIME_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: getBaseUrl().startsWith("https://"), // hacky but works perfect
  });
  return res;
}

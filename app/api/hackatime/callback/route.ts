import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/org";
import {
  exchangeCodeForToken,
  fetchMe,
  HACKATIME_STATE_COOKIE,
  linkUser,
} from "@/lib/hackatime";

function redirectTo(request: NextRequest, status: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/me?hackatime=${status}`, request.url));
  res.cookies.delete(HACKATIME_STATE_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", request.url)
    );
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(HACKATIME_STATE_COOKIE)?.value;

  if (!state || !expectedState || state !== expectedState) {
    return redirectTo(request, "state_mismatch");
  }

  if (params.get("error") || !code) {
    return redirectTo(request, "denied");
  }

  const origin = request.nextUrl.origin;
  const token = await exchangeCodeForToken(code, origin);
  if (!token) {
    return redirectTo(request, "token_error");
  }

  const me = await fetchMe(token.access_token);
  if (!me) {
    return redirectTo(request, "token_error");
  }

  try {
    await linkUser(user.id, String(me.id), token);
  } catch {
    return redirectTo(request, "token_error");
  }

  return redirectTo(request, "linked");
}

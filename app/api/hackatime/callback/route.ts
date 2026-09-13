import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/org";
import {
  exchangeCodeForToken,
  fetchMe,
  getBaseUrl,
  HackatimeAlreadyLinkedException,
  linkUser,
  stateCookieName,
} from "@/lib/hackatime";

function redirectTo(request: NextRequest, status: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/me?hackatime=${status}`, getBaseUrl()));
  res.cookies.delete(stateCookieName());
  return res;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", getBaseUrl())
    );
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(stateCookieName())?.value;

  if (!state || !expectedState || state !== expectedState) {
    return redirectTo(request, "state_mismatch");
  }

  if (params.get("error") || !code) {
    return redirectTo(request, "denied");
  }

  const token = await exchangeCodeForToken(code);
  if (!token) {
    return redirectTo(request, "token_error");
  }

  const me = await fetchMe(token.access_token);
  if (!me) {
    return redirectTo(request, "token_error");
  }

  // only link accounts whose email matches the signed-in user's verified one,
  // otherwise someone could push their own hackatime data onto another user
  const userEmail = user.email?.toLowerCase().trim();
  const meEmails = me.emails.map((e) => e.toLowerCase().trim());
  if (!userEmail || !meEmails.includes(userEmail)) {
    return redirectTo(request, "email_mismatch");
  }

  try {
    await linkUser(user.id, String(me.id), token);
  } catch (e) {
    if (e instanceof HackatimeAlreadyLinkedException) {
      return redirectTo(request, "already_linked");
    }
    return redirectTo(request, "token_error");
  }

  return redirectTo(request, "linked");
}

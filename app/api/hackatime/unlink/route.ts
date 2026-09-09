import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/org";
import { getBaseUrl, unlinkUser } from "@/lib/hackatime";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", getBaseUrl())
    );
  }

  await unlinkUser(user.id);
  return NextResponse.redirect(new URL("/me?hackatime=unlinked", getBaseUrl()));
}

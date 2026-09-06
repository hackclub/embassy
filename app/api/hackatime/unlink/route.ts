import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/org";
import { unlinkUser } from "@/lib/hackatime";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/api/auth/signin?callbackUrl=%2Fme", request.url)
    );
  }

  await unlinkUser(user.id);
  return NextResponse.redirect(new URL("/me?hackatime=unlinked", request.url));
}

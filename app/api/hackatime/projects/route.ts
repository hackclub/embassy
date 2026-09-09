import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/org";
import { getLinkedAccount, fetchProjects } from "@/lib/hackatime";
import { redis } from "@/lib/redis";

const PROJECTS_TTL_SECONDS = 60;

export async function GET() {
  const user = await getCurrentUserWithRole();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linked = await getLinkedAccount(user.id);
  if (!linked) return NextResponse.json({ projects: [] });

  const cacheKey = `hackatime:projects:${user.id}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const projects: unknown = JSON.parse(cached);
      if (
        Array.isArray(projects) &&
        projects.every((p) => typeof p === "string")
      ) {
        return NextResponse.json({ projects });
      }
    }
  } catch {
    // cache is best effort, fallback to live
  }

  const projects = await fetchProjects(linked.accessToken); // live
  if (projects) {
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(projects),
        "EX",
        PROJECTS_TTL_SECONDS,
      );
    } catch {
      // best effort, failed write = no cache lol
    }
    return NextResponse.json({ projects });
  }
  return NextResponse.json({ projects: [] });
}

import { CREDITS_PER_HOUR } from "@/lib/constants";

export function creditsForHours(hours: number | null): number {
  return hours === null ? 0 : Math.floor(hours * CREDITS_PER_HOUR);
}
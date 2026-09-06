export const PASSPORT_PRICE_CREDITS = 35;

// Credits are derived from tracked Hackatime hours. The exact rate is not
// surfaced in the UI — users just see a credit balance.
export function hoursToCredits(hours: number): number {
  return Math.floor(hours * 5);
}

export function availableCredits(hours: number | null, creditsSpent: number): number | null {
  if (hours === null) return null;
  return Math.max(0, hoursToCredits(hours) - creditsSpent);
}

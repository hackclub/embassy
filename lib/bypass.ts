// Authentication bypass for local testing / preview deployments.
// Set ADMIN_BYPASS=true to make every admin page, dashboard and server
// action accessible without signing in. Never enable in production.

export const BYPASS_USER_ID = "dev-admin-bypass";
export const BYPASS_USER = {
  id: BYPASS_USER_ID,
  name: "Dev Admin",
  email: "dev-admin@localhost",
  image: null,
} as const;

let warned = false;

export function isAuthBypassEnabled(): boolean {
  const value = (process.env.ADMIN_BYPASS ?? "").trim().toLowerCase();
  const enabled = value === "true" || value === "1" || value === "yes";
  if (enabled && !warned) {
    warned = true;
    console.warn(
      "[ADMIN_BYPASS] Authentication bypass is ACTIVE — admin pages, dashboard and actions are open without login. Never enable this in production."
    );
  }
  return enabled;
}

export function isBypassUser(userId: string): boolean {
  return isAuthBypassEnabled() && userId === BYPASS_USER_ID;
}

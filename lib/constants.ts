export const MAX_FILE_SIZE = 5_000_000; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_NOTE_LENGTH = 300;
export const MAX_NAME_LENGTH = 80;
export const MIN_NAME_LENGTH = 2;
export const FEEDBACK_RETENTION_DAYS = 30;
export const API_KEY_BYTES = 24;
export const RECIPIENT_TOKEN_BYTES = 32;
export const JWT_MAX_AGE_DAYS = 30;

export const CREDITS_PER_HOUR = 10 as const;

export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  orders: { windowMs: 60 * 1000, maxRequests: 30 },
  recipient: { windowMs: 60 * 1000, maxRequests: 20 },
  feedback: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
} as const;

export const PAGINATION = {
  defaultPageSize: 25,
  maxPageSize: 100,
  adminPageSize: 50,
} as const;

export const ORDER_TRANSITIONS = [
  "AWAITING_RECIPIENT_DETAILS",
  "RECIPIENT_DETAILS_RECEIVED",
  "DRAFTING",
  "DRAFT_READY",
  "SENT_TO_HQ",
  "RECEIVED_FROM_HQ",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
  "ERROR",
] as const;

export const FULFILLMENT_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED"] as const;

export const EVENT_TYPES = [
  "ORDER_CREATED",
  "STATUS_CHANGED",
  "RECIPIENT_DETAILS_SUBMITTED",
  "RECIPIENT_DETAILS_UPDATED",
  "PASSPORT_VERSION_CREATED",
  "PASSPORT_VERSION_PROMOTED",
  "SHIPMENT_CREATED",
  "SHIPMENT_UPDATED",
  "EMAIL_SENT",
  "EMAIL_FAILED",
  "API_KEY_REGENERATED",
  "ROLE_CHANGED",
  "ORDER_CANCELLED",
] as const;

export const ACTOR_TYPES = ["ORGANIZER", "ADMIN", "SYSTEM", "RECIPIENT", "API"] as const;

export const SUBMISSION_STATUSES = ["DRAFT", "SUBMITTED", "REJECTED"] as const;

export const ORG_ROLES = ["OWNER", "ORGANIZER"] as const;

export const USER_ROLES = ["PARTICIPANT", "ORGANIZER", "ADMIN", "SUPERADMIN"] as const;


export const ROLE_RANK = {
  PARTICIPANT: 0,
  ORGANIZER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
} as const;

export const ROLE_LABELS = {
  PARTICIPANT: "Participant",
  ORGANIZER: "Organizer",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
} as const;

export const ORDER_TRANSITION_LABELS = {
  AWAITING_RECIPIENT_DETAILS: "Awaiting details",
  RECIPIENT_DETAILS_RECEIVED: "Details received",
  DRAFTING: "Drafting",
  DRAFT_READY: "Draft ready",
  SENT_TO_HQ: "Sent to HQ",
  RECEIVED_FROM_HQ: "Received from HQ",
  SHIPPING: "Shipping",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ERROR: "Error",
} as const;

export const FULFILLMENT_STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
} as const;

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "KR", name: "South Korea" },
  { code: "TW", name: "Taiwan" },
  { code: "IL", name: "Israel" },
  { code: "ZA", name: "South Africa" },
  { code: "OTHER", name: "Other" },
] as const;

export function hasRole(role: string, minRole: string): boolean {
  return ROLE_RANK[role as keyof typeof ROLE_RANK] >= ROLE_RANK[minRole as keyof typeof ROLE_RANK];
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

export function getTransitionLabel(state: string): string {
  return ORDER_TRANSITION_LABELS[state as keyof typeof ORDER_TRANSITION_LABELS] ?? state;
}

export function getFulfillmentLabel(status: string): string {
  return FULFILLMENT_STATUS_LABELS[status as keyof typeof FULFILLMENT_STATUS_LABELS] ?? status;
}
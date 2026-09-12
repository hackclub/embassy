export const MAX_FILE_SIZE = 5_000_000; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const FEEDBACK_RETENTION_DAYS = 30;
export const RECIPIENT_TOKEN_BYTES = 32;
export const JWT_MAX_AGE_DAYS = 30;

export const CREDITS_PER_HOUR = 10 as const;

// Caps on admin-supplied numbers (defense against fat-finger / abuse).
export const MAX_CREDIT_ADJUSTMENT = 100_000;
export const MAX_REVIEWABLE_HOURS = 100_000;
export const MAX_PENDING_SUBMISSIONS_PER_USER = 5;

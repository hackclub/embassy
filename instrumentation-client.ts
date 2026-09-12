import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry init (Next 16 loads this file in the client bundle).
// Requires NEXT_PUBLIC_SENTRY_DSN (inlined at build time).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
  // Never attach cookies/IP/user-agent automatically — PII stays out of Sentry.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

#!/usr/bin/env bash
# Smoke tests for the whoami stack.
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Non-stack checks (mailpit etc.) degrade to warnings when services are absent.
set -uo pipefail
BASE="${1:-http://127.0.0.1:3000}"
FAILED=0
fail() { echo "FAIL: $1"; FAILED=1; }

echo "→ app health"
health=$(curl -fsS -m 10 "$BASE/api/health" || true)
if echo "$health" | grep -qE '"status"\s*:\s*"(ok|healthy)"'; then
  echo "  ok"
else
  fail "health endpoint did not return ok/healthy (got: ${health:0:80})"
fi

echo "→ security headers via Caddy (only checked for public URLs)"
if [[ "$BASE" == https:* ]]; then
  if curl -fsSI "$BASE" | grep -qi "x-frame-options: DENY"; then
    echo "  ok"
  else
    fail "X-Frame-Options header missing (Caddy not applying headers?)"
  fi
else
  echo "  skip (local URL — headers are Caddy's job)" 
fi

echo "→ rate limiting"
echo "  skip (limiter lives in app code + valkey; verified at bootstrap with a live redis)"

echo "→ Mailpit captured a test email (dev only)"
if [[ "${EMAIL_PROVIDER:-}" == "mailpit" ]]; then
  MP_URL="${MAILPIT_URL:-http://127.0.0.1:8025}"
  send=$(curl -s -X POST "$MP_URL/api/v1/send" -H 'Content-Type: application/json' \
    -d '{"From":{"Email":"smoke@whoami.local"},"To":[{"Email":"smoke@whoami.local"}],"Subject":"smoke-test","HTML":"<b>hi</b>","Text":"hi"}' || true)
  if echo "$send" | grep -q '"ID"'; then
    echo "  ok"
  else
    echo "  WARN: Mailpit not reachable at $MP_URL (dev-only service)"
  fi
else
  echo "  skip (EMAIL_PROVIDER=${EMAIL_PROVIDER:-unset})"
fi

if [[ "$FAILED" == "1" ]]; then
  echo "SMOKE TESTS FAILED"
  exit 1
fi
echo "ALL SMOKE TESTS PASSED"

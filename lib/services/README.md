# Services Layer

Business logic separated from the framework (Next.js) layer.

## Structure

```
lib/services/
├── index.ts           # Barrel exports
├── order.service.ts   # Order state machine (transition validation + events)
├── shop.service.ts    # Purchases, refunds, stock (advisory-locked)
├── credits.service.ts # Credit ledger (conditional, race-safe mutations)
└── email.service.ts   # Email templates (escaped), delivery + queue
```

Recipient PII encryption lives in `lib/encryption.ts` and is applied by
`app/actions/recipient.ts` on write / the recipient page on read.
Audit logging lives in `lib/audit.ts` (single implementation).

## Usage

```typescript
import { updateOrderState } from "@/lib/services/order.service";
import { buyItemInTx, lockUserPurchases } from "@/lib/services/shop.service";
import { deliverOrderEmail, processEmailQueue } from "@/lib/services/email.service";
```

## Principles

1. **Framework-agnostic** - No `next/cache` / `next/navigation` imports
2. **Single responsibility** - Each service handles one domain
3. **Type-safe** - Uses Prisma types and explicit interfaces
4. **Race-safe** - Read-then-write guards use conditional updates or advisory
   locks (`pg_advisory_xact_lock`), never bare check-then-act
5. **Auditable** - Mutations create audit logs; delivery statuses reflect
   what actually happened

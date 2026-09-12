// One-way Postgres -> Airtable mirror.
//
// Field policy: business "main info" only. Explicitly NOT mirrored:
// recipient tokens, YSWS API key hashes/prefixes/scopes, Hackatime tokens,
// encrypted recipient PII (addresses/emergency contacts), passport drafts,
// NextAuth accounts/sessions/verification tokens, and audit logs.

import { prisma } from "@/lib/prisma";
import {
  AirtableError,
  createRecords,
  deleteRecords,
  ensureTable,
  isAirtableConfigured,
  listRecords,
  updateRecords,
  type AirtableFieldSpec,
} from "./airtable";

export interface MirrorTableConfig {
  table: string;
  fields: AirtableFieldSpec[];
  rows: () => Promise<Array<Record<string, unknown>>>;
}

const id: AirtableFieldSpec = { name: "id", type: "string" };
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const MIRROR_TABLES: MirrorTableConfig[] = [
  {
    table: "Orgs",
    fields: [
      id,
      { name: "name", type: "string" },
      { name: "slug", type: "string" },
      { name: "description", type: "string" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      const orgs = await prisma.org.findMany({ select: { id: true, name: true, slug: true, description: true, createdAt: true } });
      return orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, description: o.description ?? null, createdAt: iso(o.createdAt) }));
    },
  },
  {
    table: "YSWSes",
    fields: [
      id,
      { name: "name", type: "string" },
      { name: "slug", type: "string" },
      { name: "isActive", type: "boolean" },
      { name: "org", type: "string" },
    ],
    rows: async () => {
      // No apiKeyHash/apiKeyPrefix/apiKeyScopes/apiKeyExpiresAt — API auth
      // material stays in Postgres.
      const list = await prisma.ySWS.findMany({
        select: { id: true, name: true, slug: true, isActive: true, org: { select: { name: true } } },
      });
      return list.map((y) => ({ id: y.id, name: y.name, slug: y.slug, isActive: y.isActive, org: y.org?.name ?? null }));
    },
  },
  {
    table: "Users",
    fields: [
      id,
      { name: "name", type: "string" },
      { name: "email", type: "string" },
      { name: "role", type: "string" },
      { name: "creditsBalance", type: "number" },
      { name: "emailVerified", type: "boolean" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      // slackId/hcaId/hackatimeUid intentionally omitted.
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, creditsBalance: true, emailVerified: true, createdAt: true },
      });
      return users.map((u) => ({
        id: u.id,
        name: u.name ?? null,
        email: u.email ?? null,
        role: u.role,
        creditsBalance: u.creditsBalance,
        emailVerified: u.emailVerified !== null,
        createdAt: iso(u.createdAt),
      }));
    },
  },
  {
    table: "Orders",
    fields: [
      id,
      { name: "status", type: "string" },
      { name: "currentState", type: "string" },
      { name: "totalQuantity", type: "number" },
      { name: "createdFrom", type: "string" },
      { name: "recipientName", type: "string" },
      { name: "recipientEmail", type: "string" },
      { name: "org", type: "string" },
      { name: "ysws", type: "string" },
      { name: "createdAt", type: "datetime" },
      { name: "updatedAt", type: "datetime" },
    ],
    rows: async () => {
      // recipientToken is a bearer secret — never mirrored.
      const orders = await prisma.passportOrder.findMany({
        select: {
          id: true, status: true, currentState: true, totalQuantity: true, createdFrom: true,
          recipientName: true, recipientEmail: true, createdAt: true, updatedAt: true,
          org: { select: { name: true } }, ysws: { select: { name: true } },
        },
      });
      return orders.map((o) => ({
        id: o.id, status: o.status, currentState: o.currentState, totalQuantity: o.totalQuantity,
        createdFrom: o.createdFrom, recipientName: o.recipientName ?? null, recipientEmail: o.recipientEmail ?? null,
        org: o.org?.name ?? null, ysws: o.ysws?.name ?? null,
        createdAt: iso(o.createdAt), updatedAt: iso(o.updatedAt),
      }));
    },
  },
  {
    table: "Shop Items",
    fields: [
      id,
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "category", type: "string" },
      { name: "price", type: "number" },
      { name: "stock", type: "number" },
      { name: "maxPerUser", type: "number" },
      { name: "isActive", type: "boolean" },
    ],
    rows: async () => {
      const items = await prisma.shopItem.findMany({
        select: { id: true, name: true, description: true, category: true, price: true, stock: true, maxPerUser: true, isActive: true },
      });
      return items.map((i) => ({
        id: i.id, name: i.name, description: i.description ?? null, category: i.category ?? null,
        price: i.price, stock: i.stock, maxPerUser: i.maxPerUser, isActive: i.isActive,
      }));
    },
  },
  {
    table: "Shop Orders",
    fields: [
      id,
      { name: "user", type: "string" },
      { name: "item", type: "string" },
      { name: "quantity", type: "number" },
      { name: "creditsSpent", type: "number" },
      { name: "status", type: "string" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      const rows = await prisma.shopOrder.findMany({
        select: {
          id: true, quantity: true, creditsSpent: true, status: true, createdAt: true,
          user: { select: { name: true, email: true } }, item: { select: { name: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, user: r.user?.name ?? r.user?.email ?? null, item: r.item?.name ?? null,
        quantity: r.quantity, creditsSpent: r.creditsSpent, status: r.status, createdAt: iso(r.createdAt),
      }));
    },
  },
  {
    table: "Submissions",
    fields: [
      id,
      { name: "user", type: "string" },
      { name: "title", type: "string" },
      { name: "url", type: "string" },
      { name: "status", type: "string" },
      { name: "hackatimeHours", type: "number" },
      { name: "creditsAwarded", type: "number" },
      { name: "votes", type: "number" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      const rows = await prisma.submission.findMany({
        select: {
          id: true, title: true, url: true, status: true, hackatimeHours: true, creditsAwarded: true, createdAt: true,
          user: { select: { name: true, email: true } }, _count: { select: { votes: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, user: r.user?.name ?? r.user?.email ?? null, title: r.title, url: r.url ?? null,
        status: r.status, hackatimeHours: r.hackatimeHours, creditsAwarded: r.creditsAwarded,
        votes: r._count.votes, createdAt: iso(r.createdAt),
      }));
    },
  },
  {
    table: "Credit Transactions",
    fields: [
      id,
      { name: "user", type: "string" },
      { name: "amount", type: "number" },
      { name: "type", type: "string" },
      { name: "description", type: "string" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      const rows = await prisma.creditTransaction.findMany({
        select: {
          id: true, amount: true, type: true, description: true, createdAt: true,
          user: { select: { name: true, email: true } },
        },
        take: 2000, orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id, user: r.user?.name ?? r.user?.email ?? null, amount: r.amount, type: r.type,
        description: r.description ?? null, createdAt: iso(r.createdAt),
      }));
    },
  },
  {
    table: "Order Events",
    fields: [
      id,
      { name: "order", type: "string" },
      { name: "eventType", type: "string" },
      { name: "status", type: "string" },
      { name: "previousState", type: "string" },
      { name: "newState", type: "string" },
      { name: "actorType", type: "string" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      const rows = await prisma.orderEvent.findMany({
        select: { id: true, orderId: true, eventType: true, status: true, previousState: true, newState: true, actorType: true, createdAt: true },
        take: 2000, orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id, order: r.orderId, eventType: r.eventType, status: r.status,
        previousState: r.previousState, newState: r.newState, actorType: r.actorType, createdAt: iso(r.createdAt),
      }));
    },
  },
  {
    table: "Shipments",
    fields: [
      id,
      { name: "order", type: "string" },
      { name: "carrier", type: "string" },
      { name: "trackingNumber", type: "string" },
      { name: "status", type: "string" },
      { name: "shippedAt", type: "datetime" },
      { name: "deliveredAt", type: "datetime" },
    ],
    rows: async () => {
      const rows = await prisma.shipment.findMany({
        select: { id: true, orderId: true, carrier: true, trackingNumber: true, status: true, shippedAt: true, deliveredAt: true },
      });
      return rows.map((r) => ({
        id: r.id, order: r.orderId, carrier: r.carrier ?? null, trackingNumber: r.trackingNumber ?? null,
        status: r.status ?? null, shippedAt: iso(r.shippedAt), deliveredAt: iso(r.deliveredAt),
      }));
    },
  },
  {
    table: "Email Deliveries",
    fields: [
      id,
      { name: "order", type: "string" },
      { name: "eventType", type: "string" },
      { name: "status", type: "string" },
      { name: "attempts", type: "number" },
      { name: "createdAt", type: "datetime" },
    ],
    rows: async () => {
      // recipientEmail excluded — the mirror references the order, not the inboxes.
      const rows = await prisma.emailDelivery.findMany({
        select: { id: true, orderId: true, eventType: true, status: true, attempts: true, createdAt: true },
        take: 2000, orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id, order: r.orderId ?? null, eventType: r.eventType, status: r.status,
        attempts: r.attempts, createdAt: iso(r.createdAt),
      }));
    },
  },
];

export interface TableSyncResult {
  table: string;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  error?: string;
}

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === null ? null : v);
  return norm(a) === norm(b);
}

export async function syncMirrorTable(cfg: MirrorTableConfig): Promise<TableSyncResult> {
  const result: TableSyncResult = { table: cfg.table, created: 0, updated: 0, deleted: 0, unchanged: 0 };
  try {
    await ensureTable(cfg.table, cfg.fields);
    const fieldNames = cfg.fields.map((f) => f.name);
    const dbRows = await cfg.rows();
    const byId = new Map(dbRows.map((r) => [String(r.id), r]));
    const existing = await listRecords(cfg.table, fieldNames);

    const toCreate: Array<{ fields: Record<string, unknown> }> = [];
    const toUpdate: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const seen = new Set<string>();

    for (const record of existing) {
      const key = record.fields.id;
      if (typeof key === "string" && byId.has(key)) {
        seen.add(key);
        const wanted = byId.get(key)!;
        const changed = fieldNames.some((f) => !sameValue(wanted[f], record.fields[f]));
        if (changed) toUpdate.push({ id: record.id, fields: wanted });
        else result.unchanged += 1;
      }
    }
    for (const row of dbRows) if (!seen.has(String(row.id))) toCreate.push({ fields: row });

    result.created = await createRecords(cfg.table, toCreate);
    result.updated = await updateRecords(cfg.table, toUpdate);

    // Rows in Airtable whose id no longer exists in Postgres. Only prune when
    // the source returned rows, so an empty/broken query can't wipe a table.
    const stale =
      dbRows.length > 0
        ? existing
            .filter((r) => {
              const key = r.fields.id;
              return typeof key === "string" && !byId.has(key);
            })
            .map((r) => r.id)
        : [];
    result.deleted = await deleteRecords(cfg.table, stale);
  } catch (e) {
    result.error = e instanceof AirtableError || e instanceof Error ? e.message : String(e);
  }
  return result;
}

export async function syncAllToAirtable(): Promise<TableSyncResult[]> {
  if (!isAirtableConfigured()) return [];
  const results: TableSyncResult[] = [];
  for (const cfg of MIRROR_TABLES) {
    results.push(await syncMirrorTable(cfg));
  }
  return results;
}

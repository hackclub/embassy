#!/usr/bin/env bun
// One-way Postgres -> Airtable mirror. Run from cron/CI:
//   bun run sync:airtable            # all tables
//   bun run sync:airtable -- Users   # single table (matches MIRROR_TABLES.table)
// Requires FEATURE_AIRTABLE=true, AIRTABLE_API_KEY, AIRTABLE_BASE_ID, DATABASE_URL.

import { MIRROR_TABLES, syncMirrorTable, type TableSyncResult } from "../lib/airtable-sync";
import { isAirtableConfigured } from "../lib/airtable";
import { prisma } from "../lib/prisma";

const arg = process.argv[2];

async function main() {
  if (!isAirtableConfigured()) {
    console.error("Airtable is not configured (FEATURE_AIRTABLE / AIRTABLE_API_KEY / AIRTABLE_BASE_ID).");
    process.exit(1);
  }

  const targets = arg ? MIRROR_TABLES.filter((t) => t.table.toLowerCase() === arg.toLowerCase()) : MIRROR_TABLES;
  if (targets.length === 0) {
    console.error(`Unknown mirror table "${arg}". Known: ${MIRROR_TABLES.map((t) => t.table).join(", ")}`);
    process.exit(1);
  }

  const results: TableSyncResult[] = [];
  for (const cfg of targets) {
    const r = await syncMirrorTable(cfg);
    results.push(r);
    const status = r.error ? `ERROR ${r.error}` : `+${r.created} ~${r.updated} -${r.deleted} =${r.unchanged}`;
    console.log(`${r.table.padEnd(20)} ${status}`);
  }

  const failed = results.filter((r) => r.error);
  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

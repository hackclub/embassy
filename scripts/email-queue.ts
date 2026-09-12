#!/usr/bin/env bun
// Retry pending/failed email deliveries. Run from cron (every ~5 min):
//   bun run email:queue
// Requires FEATURE_EMAIL=true and a working provider (MAILPIT_URL or LOOPS_API_KEY).

import { processEmailQueue } from "../lib/services/email.service";
import { prisma } from "../lib/prisma";

const { sent, failed } = await processEmailQueue();
console.log(`email queue: ${sent} sent, ${failed} failed`);
await prisma.$disconnect();
if (failed > 0) process.exit(1);

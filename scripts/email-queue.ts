#!/usr/bin/env bun
// usage: bun run email:queue   (cron; needs FEATURE_EMAIL + a provider)

import { processEmailQueue } from "../lib/services/email.service";
import { prisma } from "../lib/prisma";

const { sent, failed } = await processEmailQueue();
console.log(`email queue: ${sent} sent, ${failed} failed`);
await prisma.$disconnect();
if (failed > 0) process.exit(1);

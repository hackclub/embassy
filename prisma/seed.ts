#!/usr/bin/env bun

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.FORCE_SEED !== "1") {
    console.error("Refusing to seed a production database (set FORCE_SEED=1 to override).");
    process.exit(1);
  }

  console.log("Starting database seed...");

  // NOTE: we deliberately do NOT pre-create a user row for SUPERADMIN_EMAILS.
  // A row with that email would collide with the real person's first OAuth
  // sign-in (unique email), and the SUPERADMIN_EMAILS env fallback already
  // grants the role on first login.
  const org = await prisma.org.upsert({
    where: { slug: "hackclub" },
    update: {},
    create: {
      name: "Hack Club",
      slug: "hackclub",
      description: "The global network of high school hackers",
    },
  });
  console.log(`Organization created/updated: ${org.name}`);

  const upsertYSWS = async (prisma: PrismaClient) => {
    return prisma.ySWS.upsert({
      where: { slug: "hackclub" },
      update: {},
      create: {
        name: "Hack Club Summer",
        slug: "hackclub",
        apiKeyHash: await hash("wom_dev_key_placeholder", {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        }),
        apiKeyDisplay: "dev_key",
        isActive: true,
        orgId: org.id,
      },
    });
  };

  const ysws = await upsertYSWS(prisma);
  console.log(`YSWS created/updated: ${ysws.name}`);

  const organizerEmail = "organizer@embassy.local";
  const organizer = await prisma.user.upsert({
    where: { email: organizerEmail },
    update: {
      role: "ORGANIZER",
      name: "Test Organizer",
    },
    create: {
      email: organizerEmail,
      name: "Test Organizer",
      role: "ORGANIZER",
      emailVerified: new Date(),
    },
  });
  console.log(`Organizer created/updated: ${organizer.email}`);

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: organizer.id } },
    update: { role: "OWNER" },
    create: {
      orgId: org.id,
      userId: organizer.id,
      role: "OWNER",
    },
  });
  console.log(`Organizer linked to org`);

  await prisma.organizerYSWSMembership.upsert({
    where: { orgId_userId_yswsId: { orgId: org.id, userId: organizer.id, yswsId: ysws.id } },
    update: { role: "OWNER" },
    create: {
      orgId: org.id,
      userId: organizer.id,
      yswsId: ysws.id,
      role: "OWNER",
    },
  });
  console.log(`Organizer linked to YSWS`);

  const participantEmail = "participant@embassy.local";
  const participant = await prisma.user.upsert({
    where: { email: participantEmail },
    update: {
      role: "PARTICIPANT",
      name: "Test Participant",
    },
    create: {
      email: participantEmail,
      name: "Test Participant",
      role: "PARTICIPANT",
      emailVerified: new Date(),
    },
  });
  console.log(`Participant created/updated: ${participant.email}`);

  const order = await prisma.passportOrder.create({
    data: {
      orgId: org.id,
      yswsId: ysws.id,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: "Test order for development",
      createdFrom: "seed",
      recipientName: "John Doe",
      recipientEmail: "john.doe@example.com",
      recipientToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0")
      ).join(""),
      createdByUserId: organizer.id,
      recipients: {
        create: {
          email: "john.doe@example.com",
          name: "John Doe",
          userId: participant.id,
        },
      },
    },
  });
  console.log(`Test order created: ${order.id}`);

  await prisma.passportVersion.create({
    data: {
      orderId: order.id,
      version: 1,
      data: {
        front: { name: "John Doe", photo: null },
        back: { emergencyContact: "Jane Doe +1-555-123-4567" },
      },
      createdBy: organizer.id,
    },
  });
  console.log(`Passport version created`);

  await prisma.auditLog.create({
    data: {
      entityType: "PassportOrder",
      entityId: order.id,
      action: "ORDER_CREATED",
      actor: organizer.id,
      actorType: "ORGANIZER",
      description: "Test order created via seed script",
    },
  });
  console.log(`Audit log created`);
  const shopItems = [
    {
      name: "Hack Club Passport",
      description: "Physical Hack Club Passport",
      price: 50,
      category: "passport",
      stock: 100,
      maxPerUser: 1,
    },
    {
      name: "Hack Club ID Card",
      description: "It's \"Official\"",
      price: 30,
      category: "id",
      stock: 200,
      maxPerUser: 1,
    },
    {
      name: "Sticker Pack",
      description: "Freshly baked stickers",
      price: 10,
      category: "swag",
      stock: -1, // infinite
      maxPerUser: -1,
    },
    {
      name: "Lanyard",
      description: "Hang em.",
      price: 15,
      category: "accessory",
      stock: 50,
      maxPerUser: -1,
    },
  ];
  for (const item of shopItems) {
    const existing = await prisma.shopItem.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.shopItem.update({ where: { id: existing.id }, data: item });
    } else {
      await prisma.shopItem.create({ data: item });
    }
    console.log(`Shop item ensured: ${item.name}`);
  }
    
  console.log("\nDatabase seed completed successfully!");
  console.log("\nTest accounts created (dev only):");
  console.log(`  Organizer: ${organizerEmail} (ORGANIZER)`);
  console.log(`  Participant: ${participantEmail} (PARTICIPANT)`);
  console.log("  Superadmin: sign in once, then SUPERADMIN_EMAILS grants the role.");
  console.log("\nNext steps:");
  console.log("  1. Run 'bun run dev' to start development server");
  console.log("  2. Visit http://localhost:3000");
  console.log("  3. Sign in with Hack Club Auth");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2]?.trim();

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });

  if (!user) {
    console.log(`No user found${email ? ` for email: ${email}` : ""}`);
    return;
  }

  console.log("Current user:", {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPERADMIN" },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log("Updated to SUPERADMIN:", updated);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

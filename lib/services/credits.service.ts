import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface AddCreditsInput {
  userId: string;
  amount: number;
  type: "EARNED" | "ADJUSTED" | "REFUNDED";
  submissionId?: string;
  description?: string;
}

export interface SpendCreditsInput {
  userId: string;
  amount: number;
  shopOrderId?: string;
  description?: string;
}

type TxClient = Prisma.TransactionClient;

export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  return user?.creditsBalance ?? 0;
}

export async function addCredits(
  input: AddCreditsInput,
  tx: TxClient = prisma
): Promise<number> {
  if (input.amount <= 0) throw new Error("amount must be +ve");
  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      submissionId: input.submissionId ?? null,
      description: input.description ?? null,
    },
  });
  const updated = await tx.user.update({
    where: { id: input.userId },
    data: { creditsBalance: { increment: input.amount } },
    select: { creditsBalance: true },
  });
  return updated.creditsBalance;
}

export async function spendCredits(
  input: SpendCreditsInput,
  tx: TxClient = prisma
): Promise<number> {
  if (input.amount <= 0) throw new Error("amount must be +ve");
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { creditsBalance: true },
  });

  const balance = user?.creditsBalance ?? 0;
  if (balance < input.amount) {
    const err = new Error("Insufficient credits") as Error & { code?: string };
    err.code = "INSUFFICIENT_CREDITS";
    throw err;
  }
  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      amount: -input.amount,
      type: "SPENT",
      shopOrderId: input.shopOrderId ?? null,
      description: input.description ?? null,
    },
  });
  const updated = await tx.user.update({
    where: { id: input.userId },
    data: { creditsBalance: { decrement: input.amount } },
    select: { creditsBalance: true },
  });
  return updated.creditsBalance;
}

export async function adjustCredits(
  userId: string,
  amount: number,
  description?: string
): Promise<number> {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("amount must be a non-zero integer");
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });
    const balance = user?.creditsBalance ?? 0;
    if (balance + amount < 0) {
      const err = new Error("Cannot adjust below zero") as Error & { code?: string };
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }
    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "ADJUSTED",
        description: description ?? null,
      },
    });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: { increment: amount } },
      select: { creditsBalance: true },
    });
    return updated.creditsBalance;
  });
}

export async function getTransactionHistory(
  userId: string,
  limit = 50,
): Promise<Awaited<ReturnType<typeof prisma.creditTransaction.findMany>>> {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

import { prisma } from "@/lib/prisma";
import { spendCredits } from "./credits.service";

export class ShopError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface BuyItemResult {
  orderId: string;
  newBalance: number;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/* Callers can compose this with other writes in
 * the same transaction
 *
 * Order is created before spending so the SPENT ledger can reference
 * it: if spending fails the whole transaction rolls back.
 */
export async function buyItemInTx(
  tx: Tx,
  userId: string,
  itemId: string,
  quantity = 1,
  description?: string,
): Promise<BuyItemResult> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ShopError(
      "invalid_quantity",
      "Quantity must be a positive whole number.",
    );
  }

  const item = await tx.shopItem.findUnique({ where: { id: itemId } });
  if (!item || !item.isActive) {
    throw new ShopError("unavailable", "That item isn't available right now.");
  }

  const total = item.price * quantity;

  if (item.stock !== null && item.stock >= 0) {
    if (item.stock < quantity) {
      throw new ShopError(
        "out_of_stock",
        `Only ${item.stock} of "${item.name}" left in stock.`,
      );
    }
  }

  const balance = (await tx.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  }))?.creditsBalance ?? 0;
  if (balance < total) {
    const shortfall = total - balance;
    throw new ShopError(
      "insufficient_credits",
      `You need ${shortfall} more credit${shortfall === 1 ? "" : "s"} to buy ${quantity} × ${item.name}.`,
    );
  }

  if (item.maxPerUser >= 0) {
    const ownedAgg = await tx.shopOrder.aggregate({
      where: { userId, itemId: item.id, status: { not: "CANCELLED" } },
      _sum: { quantity: true },
    });
    const owned = ownedAgg._sum.quantity ?? 0;
    if (owned + quantity > item.maxPerUser) {
      const remaining = item.maxPerUser - owned;
      throw new ShopError(
        "limit_reached",
        remaining <= 0
          ? `You've reached the limit of ${item.maxPerUser} × "${item.name}".`
          : `You can only buy ${remaining} more of "${item.name}".`,
      );
    }
  }

  const order = await tx.shopOrder.create({
    data: {
      userId,
      itemId: item.id,
      quantity,
      creditsSpent: total,
      status: "PENDING",
      note: description ?? null,
    },
  });

  let newBalance = balance;
  if (total > 0) {
    newBalance = await spendCredits(
      {
        userId,
        amount: total,
        shopOrderId: order.id,
        description: description ?? `Bought ${quantity} × ${item.name}`,
      },
      tx,
    );
  }

  if (item.stock !== null && item.stock >= 0) {
    await tx.shopItem.update({
      where: { id: item.id },
      data: { stock: { decrement: quantity } },
    });
  }

  return { orderId: order.id, newBalance };
}

/**
 * Convenience wrapper.
 * PREFER buyItemInTx over buyItem.
 */
export async function buyItem(
  userId: string,
  itemId: string,
  quantity = 1,
  description?: string,
): Promise<BuyItemResult> {
  return prisma.$transaction((tx) =>
    buyItemInTx(tx, userId, itemId, quantity, description),
  );
}

// AUTOMATICALLY RUNS!!
export async function refundOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.shopOrder.findUnique({
      where: { id: orderId },
      include: { item: true },
    });
    if (!order) throw new ShopError("not_found", "Order not found.");
    if (order.status === "CANCELLED") {
      throw new ShopError("already_cancelled", "Order is already cancelled.");
    }

    if (order.creditsSpent > 0) {
      await tx.creditTransaction.create({
        data: {
          userId: order.userId,
          amount: order.creditsSpent,
          type: "REFUNDED",
          shopOrderId: order.id,
          description: `Refund for cancelled order: ${order.item.name}`,
        },
      });

      await tx.user.update({
        where: { id: order.userId },
        data: { creditsBalance: { increment: order.creditsSpent } },
      });
    }

    if (order.item.stock !== null && order.item.stock >= 0) {
      await tx.shopItem.update({
        where: { id: order.item.id },
        data: { stock: { increment: order.quantity } },
      });
    }

    await tx.shopOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
  });
}

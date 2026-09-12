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

/**
 * Serialises all shop/passport purchases for one user for the duration of
 * the enclosing transaction. Call before any read-then-write guard
 * (balance, stock, max-per-user, one-passport-at-a-time).
 */
export async function lockUserPurchases(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`embassy:buy:${userId}`}))`;
}

/* Callers can compose this with other writes in
 * the same transaction
 *
 * Order is created before spending so the SPENT ledger can reference
 * it: if spending fails the whole transaction rolls back.
 *
 * A per-user transaction-scoped advisory lock serialises concurrent
 * purchases by the same user, so balance, stock and max-per-user checks
 * cannot be raced (TOCTOU).
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

  await lockUserPurchases(tx, userId);

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
    // Conditional decrement — stock can never go negative even if the
    // advisory lock is bypassed by a different code path.
    const decremented = await tx.shopItem.updateMany({
      where: { id: item.id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (decremented.count === 0) {
      throw new ShopError("out_of_stock", `"${item.name}" just sold out.`);
    }
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

    // Claim the cancellation atomically so concurrent refunds can't both pay.
    const claimed = await tx.shopOrder.updateMany({
      where: { id: orderId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) {
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
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { refundOrder, ShopError } from "@/lib/services/shop.service";

export type ShopAdminFormState = { error?: string; ok?: string } | undefined;

async function requireAdmin(): Promise<{ id: string } | null> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin/shop");
  if (!hasRole(actor.role, "ADMIN")) return null;
  return actor;
}

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(80, "Name is too long"),
  description: z
    .string()
    .trim()
    .max(300, "Description is too long")
    .optional()
    .nullable(),
  imageUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  price: z.coerce
    .number()
    .int("Price must be a whole number")
    .min(0, "Price can't be negative"),
  category: z
    .string()
    .trim()
    .max(40, "Category is too long")
    .optional()
    .nullable(),
  stock: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce
      .number()
      .int("Stock must be a whole number")
      .min(-1, "Stock must be -1 (infinite) or 0+")
      .nullable(),
  ),
  maxPerUser: z.preprocess(
    (v) => (v === "" || v === null ? -1 : v),
    z.coerce
      .number()
      .int("Max per user must be a whole number")
      .min(-1, "Max per user must be -1 (unlimited) or 0+"),
  ),
  isActive: z.coerce.boolean(),
});

function optional(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function upsertShopItemAction(
  _prev: ShopAdminFormState,
  formData: FormData,
): Promise<ShopAdminFormState> {
  const actor = await requireAdmin();
  if (!actor) return { error: "You need admin access." };

  const itemId = optional(formData.get("itemId"));
  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    description: optional(formData.get("description")),
    imageUrl: formData.get("imageUrl") || undefined,
    price: formData.get("price"),
    category: optional(formData.get("category")),
    stock: formData.get("stock") ?? null,
    maxPerUser: formData.get("maxPerUser"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid item details.",
    };
  }

  const data = {
    name: parsed.data.name,
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl || null,
    price: parsed.data.price,
    category: parsed.data.category,
    stock: parsed.data.stock,
    maxPerUser: parsed.data.maxPerUser,
    isActive: parsed.data.isActive,
  };

  try {
    if (itemId) {
      await prisma.shopItem.update({ where: { id: itemId }, data });
    } else {
      await prisma.shopItem.create({ data });
    }
  } catch (err) {
    if (err instanceof ShopError) return { error: err.message };
    return { error: "Couldn't save the item. Try again." };
  }

  revalidatePath("/admin/shop");
  return { ok: itemId ? "Item updated." : "Item created." };
}

export async function toggleShopItemActiveAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) return;

  const itemId = optional(formData.get("itemId"));
  if (!itemId) return;

  const item = await prisma.shopItem.findUnique({
    where: { id: itemId },
    select: { isActive: true },
  });
  if (!item) return;

  await prisma.shopItem.update({
    where: { id: itemId },
    data: { isActive: !item.isActive },
  });

  revalidatePath("/admin/shop");
  revalidatePath("/me/shop");
}

export async function deleteShopItemAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) return;

  const itemId = optional(formData.get("itemId"));
  if (!itemId) return;

  try {
    await prisma.shopItem.delete({ where: { id: itemId } });
  } catch {
    return;
  }

  revalidatePath("/admin/shop");
  revalidatePath("/me/shop");
}

async function setShopOrderStatus(
  formData: FormData,
  status: "FULFILLED" | "CANCELLED",
): Promise<{ error?: string } | undefined> {
  const actor = await requireAdmin();
  if (!actor) return { error: "You need admin access." };

  const orderId = optional(formData.get("orderId"));
  if (!orderId) return { error: "Missing order." };

  try {
    if (status === "CANCELLED") {
      await refundOrder(orderId);
    } else {
      await prisma.shopOrder.update({
        where: { id: orderId },
        data: { status: "FULFILLED" },
      });
    }
  } catch (err) {
    if (err instanceof ShopError) return { error: err.message };
    return { error: "Couldn't update the order. Try again." };
  }

  revalidatePath("/admin/shop");
  revalidatePath("/me/shop");
  return;
}

export async function fulfillShopOrderAction(
  formData: FormData,
): Promise<void> {
  const result = await setShopOrderStatus(formData, "FULFILLED");
  if (result?.error) return;
}

export async function cancelShopOrderAction(formData: FormData): Promise<void> {
  const result = await setShopOrderStatus(formData, "CANCELLED");
  if (result?.error) return;
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buyShopItemAction, type ShopFormState } from "@/app/actions/me";

interface BuyItemFormProps {
  itemId: string;
  itemName: string;
  price: number;
  balance: number;
  owned: number;
  maxPerUser?: number;
  inStock: boolean;
  requiresPassport?: boolean;
  hasActiveOrder?: boolean;
}

export default function BuyItemForm({
  itemId,
  itemName,
  price,
  balance,
  owned,
  maxPerUser = -1,
  inStock,
  requiresPassport = false,
  hasActiveOrder = false,
}: BuyItemFormProps) {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(
    buyShopItemAction,
    undefined
  );
  const [quantity, setQuantity] = useState(1);

  if (state?.ok && state.trackUrl) {
    return (
      <div className="govuk-notification-banner govuk-notification-banner--success" role="alert">
        <p className="font-bold">Your order is in!</p>
        <p>{state.ok}</p>
        <Link href={state.trackUrl} className="govuk-button mt-3">
          Track
        </Link>
      </div>
    );
  }

  const remaining = maxPerUser < 0 ? Infinity : Math.max(0, maxPerUser - owned);
  const atLimit = remaining <= 0;
  const maxQty = Math.min(
    5,
    requiresPassport ? 1 : remaining === Infinity ? 5 : Math.floor(remaining)
  );
  const qty = requiresPassport ? 1 : Math.min(Math.max(1, quantity), Math.max(1, maxQty));
  const total = price * qty;
  const canBuy = !pending && inStock && !atLimit && !hasActiveOrder && balance >= total;

  return (
    <div>
      {state?.error && (
        <div className="govuk-notification-banner govuk-notification-banner--error mb-4" role="alert">
          <p className="font-bold">{state.error}</p>
        </div>
      )}
      {state?.ok && !state.trackUrl && (
        <div className="govuk-notification-banner govuk-notification-banner--success" role="alert">
          <p className="font-bold">{state.ok}</p>
        </div>
      )}
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="itemId" value={itemId} />
        <div>
          <label
            htmlFor={`qty-${itemId}`}
            className="mb-1 block text-xs font-semibold text-govuk-grey-4"
          >
            Qty
          </label>
          <select
            id={`qty-${itemId}`}
            name="quantity"
            value={qty}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            disabled={pending || requiresPassport || atLimit || !inStock}
            className="border-2 border-govuk-black bg-white px-2 py-1.5 text-sm"
          >
            {[...Array(maxQty)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="govuk-button" disabled={!canBuy}>
          {pending ? "Buying..." : `Buy for ${total} credits`}
        </button>
      </form>
      {!pending && (
        <>
          {!inStock && <p className="mt-2 text-sm text-govuk-grey-4">{itemName} is out of stock.</p>}
          {inStock && atLimit && (
            <p className="mt-2 text-sm text-govuk-grey-4">
              You&apos;ve reached the limit for {itemName}.
            </p>
          )}
          {inStock && !atLimit && !hasActiveOrder && balance < total && (
            <p className="mt-2 text-sm text-govuk-grey-4">
              You need {total - balance} more credit{total - balance === 1 ? "" : "s"}.
            </p>
          )}
          {requiresPassport && hasActiveOrder && (
            <p className="mt-2 text-sm text-govuk-grey-4">
              You already have a passport on the way.
            </p>
          )}
        </>
      )}
    </div>
  );
}
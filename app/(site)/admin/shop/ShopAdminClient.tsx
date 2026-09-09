"use client";

import { useActionState } from "react";
import {
  upsertShopItemAction,
  toggleShopItemActiveAction,
  deleteShopItemAction,
  fulfillShopOrderAction,
  cancelShopOrderAction,
} from "@/app/actions/shop";
import type { ShopAdminFormState } from "@/app/actions/shop";

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  category: string | null;
  stock: number | null;
  maxPerUser: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: string;
  quantity: number;
  creditsSpent: number;
  status: "PENDING" | "FULFILLED" | "CANCELLED";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string | null } | null;
  item: { name: string; price: number };
};

export default function ShopAdminClient({
  items,
  orders,
}: {
  items: ItemRow[];
  orders: OrderRow[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-3xl font-bold leading-tight tracking-tight">Shop</h1>
        <p className="mb-4 text-govuk-grey-4">
          Manage the items participants can buy with credits.
        </p>

        <h2 className="mb-2 text-lg font-bold">Items</h2>
        <div className="space-y-4">
          {items.length === 0 && (
            <p className="text-sm text-govuk-grey-4">No items.</p>
          )}
          {items.map((item) => (
            <ItemEditor key={item.id} item={item} />
          ))}
          <NewItemForm />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-govuk-grey-4">No shop orders yet.</p>
        ) : (
          <ul className="space-y-0" role="list">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-govuk-grey-2 py-3 last:border-b"
              >
                <div>
                  <p className="font-semibold">
                    {order.item.name} × {order.quantity}
                  </p>
                  <p className="text-sm text-govuk-grey-4">
                    {order.user?.name ?? order.user?.email ?? "Unknown user"} ·{" "}
                    {order.creditsSpent} credits
                  </p>
                  <span
                    className={`text-xs font-bold ${
                      order.status === "PENDING"
                        ? "text-govuk-orange"
                        : order.status === "FULFILLED"
                          ? "text-govuk-green"
                          : "text-govuk-grey-4"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={fulfillShopOrderAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      className="govuk-button govuk-button--secondary"
                      disabled={order.status !== "PENDING"}
                    >
                      Fulfill
                    </button>
                  </form>
                  <form action={cancelShopOrderAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      className="govuk-button govuk-button--warning"
                      disabled={order.status !== "PENDING"}
                    >
                      Cancel & refund
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ItemEditor({ item }: { item: ItemRow }) {
  const [state, action, pending] = useActionState<ShopAdminFormState, FormData>(
    upsertShopItemAction,
    undefined,
  );

  return (
    <div className="border-2 border-govuk-black p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{item.name}</h3>
        <div className="flex items-center gap-2">
          <form action={toggleShopItemActiveAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              className="text-sm font-semibold underline underline-offset-4"
            >
              {item.isActive ? "Deactivate" : "Activate"}
            </button>
          </form>
          <form action={deleteShopItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              className="text-sm font-semibold text-hc-red underline underline-offset-4"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
      <form action={action} noValidate>
        <input type="hidden" name="itemId" value={item.id} />
        <ItemFields item={item} />
        {state?.error && (
          <p role="alert" className="mt-2 border-l-4 border-hc-red px-3 py-1 font-semibold">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="mt-2 border-l-4 border-govuk-green px-3 py-1 font-semibold">
            {state.ok}
          </p>
        )}
        <button type="submit" disabled={pending} className="govuk-button mt-3">
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}

function NewItemForm() {
  const [state, action, pending] = useActionState<ShopAdminFormState, FormData>(
    upsertShopItemAction,
    undefined,
  );

  return (
    <form action={action} className="border-2 border-dashed border-govuk-grey-2 p-4" noValidate>
      <h3 className="mb-3 text-base font-bold">Add an item</h3>
      <ItemFields />
      {state?.error && (
        <p role="alert" className="mt-2 border-l-4 border-hc-red px-3 py-1 font-semibold">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-2 border-l-4 border-govuk-green px-3 py-1 font-semibold">{state.ok}</p>
      )}
      <button type="submit" disabled={pending} className="govuk-button mt-3">
        {pending ? "Creating..." : "Create item"}
      </button>
    </form>
  );
}

function ItemFields({ item }: { item?: ItemRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="name" className="mb-1 block font-bold">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={item?.name ?? ""}
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="price" className="mb-1 block font-bold">
          Price (credits)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={item?.price ?? ""}
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="category" className="mb-1 block font-bold">
          Category
        </label>
        <input
          id="category"
          name="category"
          placeholder="swag, tech, passport..."
          defaultValue={item?.category ?? ""}
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="stock" className="mb-1 block font-bold">
          Stock
        </label>
        <input
          id="stock"
          name="stock"
          type="number"
          min="-1"
          step="1"
          defaultValue={item?.stock ?? ""}
          placeholder="-1 = unlimited"
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="maxPerUser" className="mb-1 block font-bold">
          Max per user
        </label>
        <input
          id="maxPerUser"
          name="maxPerUser"
          type="number"
          min="-1"
          step="1"
          defaultValue={item?.maxPerUser ?? -1}
          placeholder="-1 = unlimited"
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="imageUrl" className="mb-1 block font-bold">
          Image URL
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          placeholder="https://..."
          defaultValue={item?.imageUrl ?? ""}
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="description" className="mb-1 block font-bold">
          Description
        </label>
        <input
          id="description"
          name="description"
          defaultValue={item?.description ?? ""}
          className="w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <label className="flex items-center gap-2 font-bold md:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={item?.isActive ?? true}
          className="h-4 w-4"
        />
        Active (visible in the shop)
      </label>
    </div>
  );
}
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import { isHackatimeConfigured } from "@/lib/hackatime";
import { getBalance } from "@/lib/services/credits.service";
import PageHeader from "@/app/components/PageHeader";
import StatusBadge from "@/app/components/StatusBadge";
import { mapOrderStateToVariant } from "@/app/components/status-variant";
import BuyItemForm from "./BuyItemForm";

const ACTIVE_STATES = ["DELIVERED", "CANCELLED", "ERROR"];

type BannerVariant = "success" | "warning" | "error";

const BANNER_MESSAGES: Record<string, { title: string; text: string; variant: BannerVariant }> = {
  linked: {
    title: "Hackatime linked",
    text: "Your Hackatime account is now connected. Your credits are ready to spend here.",
    variant: "success",
  },
  denied: {
    title: "Hackatime not linked",
    text: "You declined the Hackatime connection request. You can try again at any time.",
    variant: "warning",
  },
  unconfigured: {
    title: "Hackatime not linked",
    text: "Hackatime linking is not available right now. Try again later.",
    variant: "warning",
  },
  token_error: {
    title: "Hackatime link failed",
    text: "There was a problem getting an access token from Hackatime. Please try again.",
    variant: "error",
  },
  state_mismatch: {
    title: "Hackatime link failed",
    text: "The connection could not be verified. Please start again.",
    variant: "error",
  },
};

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ hackatime?: string }>;
}) {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const { hackatime } = await searchParams;
  const banner = hackatime ? BANNER_MESSAGES[hackatime] : undefined;

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hackatimeUid: true },
  });
  const linked = Boolean(account?.hackatimeUid);
  const configured = isHackatimeConfigured();

  const [items, balance, orders, ownedByItem] = await Promise.all([
    prisma.shopItem.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    getBalance(user.id),
    prisma.passportOrder.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, currentState: true, recipientToken: true, createdAt: true },
    }),
    prisma.shopOrder.groupBy({
      by: ["itemId"],
      where: { userId: user.id, status: { not: "CANCELLED" } },
      _sum: { quantity: true },
    }),
  ]);

  const ownedMap = new Map(ownedByItem.map((r) => [r.itemId, r._sum.quantity ?? 0]));

  const hasActiveOrder = orders.some((o) => !ACTIVE_STATES.includes(o.currentState));

  return (
    <>
      <PageHeader title="Shop" description="Spend your credits on real things." />

      {banner && (
        <div className={`govuk-notification-banner govuk-notification-banner--${banner.variant} mb-6`} role="alert">
          <p className="font-bold">{banner.title}</p>
          <p>{banner.text}</p>
        </div>
      )}

      <div className="govuk-inset mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-2xl font-bold">You have {balance} credits</p>
        {configured && !linked && (
          <a href="/api/hackatime/authorize" className="govuk-button">
            Link Hackatime
          </a>
        )}
      </div>

      {items.length === 0 ? (
        <div className="game-box py-12 text-center">
          <p className="text-govuk-grey-4">Nothing in the shop right now — check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const inStock = item.stock === null || item.stock < 0 || item.stock > 0;
            const soldOut = item.stock !== null && item.stock >= 0 && item.stock <= 0;
            const owned = ownedMap.get(item.id) ?? 0;
            return (
              <div key={item.id} className="game-box flex flex-col">
                <div className="mb-3 aspect-4/3 overflow-hidden rounded border border-govuk-grey-2 bg-white">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={400}
                      height={300}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      className="rounded"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-govuk-grey-4">
                      {item.name}
                    </div>
                  )}
                </div>
                <h2 className="mb-1 text-xl font-bold">{item.name}</h2>
                {item.description && (
                  <p className="mb-2 text-sm leading-relaxed text-govuk-grey-4">{item.description}</p>
                )}
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span className="font-extrabold">{item.price} credits</span>
                  {soldOut ? (
                    <span className="govuk-tag govuk-tag--grey">Sold out</span>
                  ) : inStock ? (
                    <span className="govuk-tag govuk-tag--blue">In stock</span>
                  ) : null}
                  {owned > 0 && (
                    <span className="govuk-tag govuk-tag--grey">You own {owned}</span>
                  )}
                </div>
                <div className="mt-auto">
                  <BuyItemForm
                    itemId={item.id}
                    itemName={item.name}
                    price={item.price}
                    balance={balance}
                    maxPerUser={item.maxPerUser}
                    owned={owned}
                    inStock={inStock}
                    requiresPassport={item.category === "passport"}
                    hasActiveOrder={item.category === "passport" && hasActiveOrder}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orders.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Your passport orders</h2>
          <ul className="space-y-0" role="list">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-govuk-grey-2 py-4 last:border-b"
              >
                <span className="text-sm text-govuk-grey-4">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(order.createdAt)}
                </span>
                <StatusBadge variant={mapOrderStateToVariant(order.currentState)} />
                {order.recipientToken && (
                  <Link
                    href={`/track/${order.recipientToken}`}
                    className="text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                  >
                    Track
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import { getHackatimeHours, isHackatimeConfigured } from "@/lib/hackatime";
import PageHeader from "@/app/components/PageHeader";
import StatusBadge from "@/app/components/StatusBadge";
import { mapOrderStateToVariant } from "@/app/components/status-variant";
import BuyPassportForm from "./BuyPassportForm";
import { PASSPORT_PRICE_CREDITS } from "@/lib/shop-prices";

const ACTIVE_STATES = ["DELIVERED", "CANCELLED", "ERROR"];

type BannerVariant = "success" | "warning" | "error";

const BANNER_MESSAGES: Record<string, { title: string; text: string; variant: BannerVariant }> = {
  linked: {
    title: "Hackatime linked",
    text: "Your Hackatime account is now connected. Your tracked coding time is now credits you can spend here.",
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
    select: { hackatimeUid: true, creditsSpent: true },
  });
  const linked = Boolean(account?.hackatimeUid);
  const configured = isHackatimeConfigured();

  let credits: number | null = null;
  let hoursFetchFailed = false;
  if (configured && linked && account) {
    const hours = await getHackatimeHours(user.id);
    if (hours === null) {
      hoursFetchFailed = true;
    } else {
      credits = Math.max(0, Math.floor(hours) - account.creditsSpent);
    }
  }

  const orders = await prisma.passportOrder.findMany({
    where: { recipientUserId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, currentState: true, recipientToken: true, createdAt: true },
  });

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

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex-shrink-0">
          <Image
            src="/passport.png"
            alt="Hack Club Passport"
            width={220}
            height={220}
            style={{ width: 220, height: "auto" }}
            className="rounded border border-govuk-grey-2"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 text-2xl font-bold">Hack Club Passport</h2>
          <p className="mb-4 leading-relaxed">
            A real, physical passport you can earn by building things. It ships to
            you, and you can fill it with stamps from Hack Club YSWSs as you ship
            projects.
          </p>
          <div className="govuk-inset">
            <p className="text-3xl font-bold">{PASSPORT_PRICE_CREDITS} credits</p>
            <p className="mt-1 text-govuk-grey-4">
              1 credit = 1 hour of tracked coding time (Hackatime, optional)
            </p>
          </div>
        </div>
      </div>

      {configured ? (
        linked ? (
          <div className="govuk-inset mt-8">
            {hoursFetchFailed ? (
              <p>Could not fetch your Hackatime hours right now. Try refreshing in a minute.</p>
            ) : (
              <>
                <p className="text-2xl font-bold">You have {credits ?? 0} credits</p>
                {credits !== null && credits < PASSPORT_PRICE_CREDITS && (
                  <div className="govuk-warning-text mt-4">
                    <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                    <strong className="govuk-warning-text__text">
                      You need {PASSPORT_PRICE_CREDITS - credits} more credit
                      {PASSPORT_PRICE_CREDITS - credits === 1 ? "" : "s"} to claim a passport.
                    </strong>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="govuk-notification-banner govuk-notification-banner--warning mt-8" role="alert">
            <p className="font-bold">Link Hackatime to buy</p>
            <p>
              Linking Hackatime is optional, but you need linked credits to buy the
              passport.
            </p>
            <a href="/api/hackatime/authorize" className="govuk-button mt-3">
              Link Hackatime
            </a>
          </div>
        )
      ) : (
        <div className="govuk-inset mt-8">
          <span className="govuk-tag govuk-tag--grey">Hackatime linking not configured</span>
          <p className="mt-2 text-govuk-grey-4">
            Buying is unavailable on this deployment.
          </p>
        </div>
      )}

      {configured && linked && (
        <div className="mt-8">
          <BuyPassportForm
            disabled={hasActiveOrder || (credits !== null && credits < PASSPORT_PRICE_CREDITS)}
            hint={hasActiveOrder ? "You already have a passport on the way." : undefined}
          />
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

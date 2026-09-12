import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Section from "../../components/Section";
import StatusBadge from "../../components/StatusBadge";
import { mapOrderStateToVariant } from "../../components/status-variant";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Track your passport",
  description: "Track the status of your Hack Club Passport order.",
  robots: { index: false },
};

function dateLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function datetimeLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const TIMELINE_STEPS = [
  { state: "AWAITING_RECIPIENT_DETAILS", label: "Order created", description: "Your passport order has been created. We're waiting for your details." },
  { state: "RECIPIENT_DETAILS_RECEIVED", label: "Details received", description: "We've received your details and are preparing your passport." },
  { state: "DRAFTING", label: "Passport being drafted", description: "Your passport is being drafted by our team." },
  { state: "DRAFT_READY", label: "Draft ready for review", description: "The draft is ready and will be reviewed shortly." },
  { state: "SENT_TO_HQ", label: "Sent to HQ", description: "Your passport has been sent to Hack Club HQ for printing." },
  { state: "RECEIVED_FROM_HQ", label: "Received from HQ", description: "Hack Club HQ has received your passport and is preparing it for shipping." },
  { state: "SHIPPING", label: "Shipped", description: "Your passport is on its way to you!" },
  { state: "DELIVERED", label: "Delivered", description: "Your passport has been delivered." },
];

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const order = await prisma.passportOrder.findUnique({
    where: { recipientToken: token },
    include: {
      org: { select: { name: true } },
      ysws: { select: { name: true } },
      shipments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    notFound();
  }

  const currentStateIndex = TIMELINE_STEPS.findIndex((s) => s.state === order.currentState);

  return (
    <div className="min-h-screen flex flex-col bg-govuk-white">
      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <header className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/passport.png"
              alt="Hack Club Passport"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="mb-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Hack Club Passport
          </h1>
          <p className="text-lg text-govuk-grey-4">Track your passport order</p>
        </header>

        {/* Current status */}
        <Section title="Current status" divider={false}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <StatusBadge variant={mapOrderStateToVariant(order.currentState)} />
            <p className="text-govuk-grey-4 text-sm">
              {TIMELINE_STEPS[currentStateIndex]?.description ?? "Your passport is being processed."}
            </p>
          </div>
        </Section>

        {/* Timeline */}
        <Section title="Timeline" divider={false}>
          <div className="tl">
            {TIMELINE_STEPS.map((step, index) => {
              const isComplete = index <= currentStateIndex;
              const isCurrent = index === currentStateIndex;
              const event = order.events.find((e) => e.newState === step.state);
              return (
                <div key={step.state} className="tl-step">
                  <div className="tl-dot" style={{ background: isComplete ? "#e33f54" : "#cecece", outlineColor: isComplete ? "#e33f54" : "#cecece" }} />
                  <div className="ms-4">
                    <div className="flex items-baseline gap-2">
                      <h3 className={`font-medium ${isCurrent ? "text-hc-red" : ""}`}>{step.label}</h3>
                      {event && (
                        <span className="text-sm text-govuk-grey-4">
                          {datetimeLabel(event.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-govuk-grey-4">{step.description}</p>
                    {isCurrent && !isComplete && (
                      <p className="mt-1 text-sm text-hc-red">Current status</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Recipient details */}
        <Section title="Your details" divider={false}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-govuk-grey-4">Name</dt>
              <dd className="mt-1 font-medium">{order.recipientName ?? "&mdash;"}</dd>
            </div>
            <div>
              <dt className="text-sm text-govuk-grey-4">Email</dt>
              <dd className="mt-1 font-medium">{order.recipientEmail ?? "&mdash;"}</dd>
            </div>
            <div>
              <dt className="text-sm text-govuk-grey-4">YSWS</dt>
              <dd className="mt-1 font-medium">{order.ysws?.name ?? order.org.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-govuk-grey-4">Order created</dt>
              <dd className="mt-1 font-medium">{dateLabel(order.createdAt)}</dd>
            </div>
          </dl>
        </Section>

        {/* Shipment info */}
        {order.shipments.length > 0 && (
          <Section title="Shipment" divider={false}>
            {order.shipments.map((shipment) => (
              <div key={shipment.id} className="border-2 border-govuk-black bg-govuk-grey-1 p-4 space-y-3">
                {shipment.trackingNumber && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Tracking number</dt>
                    <dd className="mt-1 font-mono text-lg">{shipment.trackingNumber}</dd>
                  </div>
                )}
                {shipment.carrier && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Carrier</dt>
                    <dd className="mt-1 font-medium">{shipment.carrier}</dd>
                  </div>
                )}
                {shipment.status && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Status</dt>
                    <dd className="mt-1 font-medium">
                      <StatusBadge variant={mapOrderStateToVariant("")} label={shipment.status} />
                    </dd>
                  </div>
                )}
                {shipment.shippedAt && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Shipped</dt>
                    <dd className="mt-1 font-medium">{dateLabel(shipment.shippedAt)}</dd>
                  </div>
                )}
                {shipment.deliveredAt && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Delivered</dt>
                    <dd className="mt-1 font-medium">{dateLabel(shipment.deliveredAt)}</dd>
                  </div>
                )}
                {shipment.note && (
                  <div>
                    <dt className="text-sm text-govuk-grey-4">Note</dt>
                    <dd className="mt-1 font-medium">{shipment.note}</dd>
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* What happens next */}
        {currentStateIndex < TIMELINE_STEPS.length - 1 && order.currentState !== "CANCELLED" && order.currentState !== "ERROR" && (
          <Section title="What happens next" divider={false}>
            <div className="govuk-inset">
              <p className="text-govuk-grey-4">
                {TIMELINE_STEPS[currentStateIndex + 1]?.description ?? "Your passport will continue through the process."}
              </p>
            </div>
          </Section>
        )}

        {order.currentState === "CANCELLED" && (
          <Section title="Order cancelled" divider={false}>
            <div className="govuk-inset border-l-4 border-hc-red">
              <p className="text-govuk-grey-4">
                This passport order has been cancelled. If you have questions, please contact the YSWS organizer.
              </p>
            </div>
          </Section>
        )}

        {order.currentState === "ERROR" && (
          <Section title="Error" divider={false}>
            <div className="govuk-inset border-l-4 border-hc-red">
              <p className="text-govuk-grey-4">
                There was an error processing this order. Please contact the YSWS organizer for assistance.
              </p>
            </div>
          </Section>
        )}

        <footer className="mt-8 pt-6 border-t border-govuk-grey-2 text-center text-sm text-govuk-grey-4">
          <p>Questions? Contact <Link href="mailto:passports@hackclub.com" className="underline underline-offset-2 hover:text-hc-red">passports@hackclub.com</Link></p>
        </footer>
      </div>
    </div>
  );
}

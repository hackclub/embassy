import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";
import StatusBadge from "@/app/components/StatusBadge";
import {
  mapOrderStateToVariant,
  mapFulfillmentStatusToVariant,
} from "@/app/components/status-variant";
import ServerTable from "@/app/components/ServerTable";
import Link from "next/link";

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
  { state: "RECIPIENT_DETAILS_RECEIVED", label: "Recipient details received", description: "We've received your details and are preparing your passport." },
  { state: "DRAFTING", label: "Passport drafting started", description: "Your passport is being drafted by our team." },
  { state: "DRAFT_READY", label: "Draft ready for review", description: "The draft is ready and will be reviewed shortly." },
  { state: "SENT_TO_HQ", label: "Sent to HQ", description: "Your passport has been sent to Hack Club HQ for printing." },
  { state: "RECEIVED_FROM_HQ", label: "Received from HQ", description: "Hack Club HQ has received your passport and is preparing it for shipping." },
  { state: "SHIPPING", label: "Shipped to recipient", description: "Your passport is on its way to you!" },
  { state: "DELIVERED", label: "Delivered", description: "Your passport has been delivered." },
];

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserWithRole();
  const { id } = await params;

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const order = await prisma.passportOrder.findUnique({
    where: { id },
    include: {
      org: { select: { name: true, slug: true, id: true } },
      ysws: { select: { name: true, slug: true, isActive: true, id: true } },
      user: { select: { name: true, email: true, id: true } },
      recipient: { select: { name: true, email: true, id: true } },
      recipients: { select: { name: true, email: true, createdAt: true } },
      versions: { orderBy: { version: "desc" }, take: 5 },
      shipments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    redirect("/admin/orders");
  }

  const currentStateIndex = TIMELINE_STEPS.findIndex((s) => s.state === order.currentState);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "whoami", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Passport orders", href: "/admin/orders" },
          { label: `Order ${id.slice(0, 8)}...` },
        ]}
      />

      <PageHeader
        title={`Order ${id.slice(0, 8)}...`}
        description={`Full ID: ${id}`}
        backHref="/admin/orders"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {/* Order header */}
          <Section title="Order details" divider={false}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-govuk-grey-4">YSWS</dt>
                <dd className="mt-1 font-medium">
                  {order.ysws ? (
                    <Link href={`/admin/yswses/${order.ysws.id}`} className="hover:underline">
                      {order.ysws.name}
                    </Link>
                  ) : (
                    <Link href={`/admin/yswses/${order.org.id}`} className="hover:underline">
                      {order.org.name}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Created by</dt>
                <dd className="mt-1 font-medium">
                  {order.user ? (
                    <Link href={`/admin/users/${order.user.id}`} className="hover:underline">
                      {order.user.name ?? order.user.email}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">State</dt>
                <dd className="mt-1 font-medium">
                  <StatusBadge variant={mapOrderStateToVariant(order.currentState)} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Fulfillment</dt>
                <dd className="mt-1 font-medium">
                  <StatusBadge variant={mapFulfillmentStatusToVariant(order.status)} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Created</dt>
                <dd className="mt-1 font-medium">{dateLabel(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Updated</dt>
                <dd className="mt-1 font-medium">{dateLabel(order.updatedAt)}</dd>
              </div>
              {order.note && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-govuk-grey-4">Note</dt>
                  <dd className="mt-1 font-medium whitespace-pre-wrap">{order.note}</dd>
                </div>
              )}
            </dl>
          </Section>

          {/* Timeline */}
          <Section title="Timeline" divider={false}>
            <div className="tl">
              {TIMELINE_STEPS.map((step, index) => {
                const isComplete = index <= currentStateIndex;
                const isCurrent = index === currentStateIndex;
                const event = order.events.find((e: typeof order.events[number]) => e.newState === step.state);
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

          {/* Recipient */}
          <Section title="Recipient" divider={false}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-govuk-grey-4">Name</dt>
                <dd className="mt-1 font-medium">{order.recipientName ?? "&mdash;"}</dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Email</dt>
                <dd className="mt-1 font-medium">{order.recipientEmail ?? "&mdash;"}</dd>
              </div>
              {order.recipientUserId && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-govuk-grey-4">Linked account</dt>
                  <dd className="mt-1 font-medium">
                    <Link href={`/admin/users/${order.recipientUserId}`} className="hover:underline">
                      View user profile
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Section>

          {/* Passport versions */}
          {order.versions.length > 0 && (
            <Section title="Passport versions" divider={false}>
              <ServerTable
                columns={[
                  { key: "version", header: "Version", className: "w-20 text-center", render: (v: typeof order.versions[0]) => v.version },
                  { key: "createdBy", header: "Created by", render: (v: typeof order.versions[0]) => v.createdBy },
                  { key: "createdAt", header: "Created", className: "w-32", render: (v: typeof order.versions[0]) => datetimeLabel(v.createdAt) },
                ]}
                data={order.versions}
                rowKey="id"
                emptyMessage="No passport versions."
              />
            </Section>
          )}

          {/* Shipments */}
          {order.shipments.length > 0 && (
            <Section title="Shipments" divider={false}>
              <ServerTable
                columns={[
                  { key: "trackingNumber", header: "Tracking", render: (s: typeof order.shipments[0]) => s.trackingNumber ?? "&mdash;" },
                  { key: "carrier", header: "Carrier", render: (s: typeof order.shipments[0]) => s.carrier ?? "&mdash;" },
                  { key: "status", header: "Status", render: (s: typeof order.shipments[0]) => s.status ?? "&mdash;" },
                  { key: "shippedAt", header: "Shipped", className: "w-28", render: (s: typeof order.shipments[0]) => s.shippedAt ? dateLabel(s.shippedAt) : "&mdash;" },
                  { key: "deliveredAt", header: "Delivered", className: "w-28", render: (s: typeof order.shipments[0]) => s.deliveredAt ? dateLabel(s.deliveredAt) : "&mdash;" },
                ]}
                data={order.shipments}
                rowKey="id"
                emptyMessage="No shipments."
              />
            </Section>
          )}

          {/* Activity */}
          {order.events.length > 0 && (
            <Section title="Activity" divider={false}>
              <ServerTable
                columns={[
                  { key: "when", header: "When", className: "w-36", render: (e: typeof order.events[0]) => datetimeLabel(e.createdAt) },
                  { key: "type", header: "Event", className: "w-36", render: (e: typeof order.events[0]) => (
                    <span className="govuk-tag govuk-tag--grey text-xs">{e.eventType.replace(/_/g, " ")}</span>
                  ) },
                  { key: "actor", header: "Actor", className: "w-28", render: (e: typeof order.events[0]) => (
                    <>
                      <span className="font-mono text-xs">{e.actor.slice(0, 8)}&hellip;</span>
                      <span className="block text-xs text-govuk-grey-4">{e.actorType ?? "&mdash;"}</span>
                    </>
                  ) },
                  { key: "description", header: "Details", render: (e: typeof order.events[0]) => e.description ?? "&mdash;" },
                ]}
                data={order.events}
                rowKey="id"
                emptyMessage="No activity."
              />
            </Section>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <Section title="Actions" divider={false}>
            <div className="space-y-3">
              <Link href={`/admin/orders/${id}/edit`} className="govuk-button govuk-button--secondary w-full block text-center">
                Edit order
              </Link>
              {order.currentState !== "DELIVERED" && order.currentState !== "CANCELLED" && (
                <Link href={`/admin/orders/${id}/state`} className="govuk-button w-full block text-center">
                  Update state
                </Link>
              )}
              <Link href={`/track/${order.recipientToken}`} target="_blank" className="govuk-button govuk-button--secondary w-full block text-center">
                View tracking page
              </Link>
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}
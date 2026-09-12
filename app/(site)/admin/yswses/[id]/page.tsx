import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";
import StatusBadge from "@/app/components/StatusBadge";
import { mapYSWSActiveToVariant } from "@/app/components/status-variant";
import ServerTable from "@/app/components/ServerTable";
import Link from "next/link";

function dateLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function AdminYSWSDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserWithRole();
  const { id } = await params;

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const ysws = await prisma.ySWS.findUnique({
    where: { id },
    include: {
      org: { select: { name: true, slug: true, id: true } },
      organizerMemberships: {
        include: {
          user: { select: { name: true, email: true, role: true, id: true } },
          org: { select: { name: true, id: true } },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { org: { select: { name: true, id: true } }, user: { select: { name: true, email: true, id: true } } },
      },
    },
  });

  if (!ysws) {
    redirect("/admin/yswses");
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Embassy", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "YSWSes", href: "/admin/yswses" },
          { label: ysws.name },
        ]}
      />

      <PageHeader
        title={ysws.name}
        description={`Slug: ${ysws.slug}`}
        backHref="/admin/yswses"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {/* Details */}
          <Section title="Details" divider={false}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-govuk-grey-4">Status</dt>
                <dd className="mt-1 font-medium">
                  <StatusBadge variant={mapYSWSActiveToVariant(ysws.isActive)} label={ysws.isActive ? "Active" : "Inactive"} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Org</dt>
                <dd className="mt-1 font-medium">
                  {ysws.org ? ysws.org.name : "&mdash;"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Slug</dt>
                <dd className="mt-1 font-mono text-sm">{ysws.slug}</dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">API key</dt>
                <dd className="mt-1 font-mono text-sm break-all">
                  {user.role === "SUPERADMIN" ? (ysws.apiKeyDisplay ? ysws.apiKeyDisplay : "••••") : ysws.apiKeyDisplay ? "wom_" + "•".repeat(24) : "&mdash;"}
                </dd>
              </div>
            </dl>
          </Section>

          {/* Organizers */}
          {ysws.organizerMemberships.length > 0 && (
            <Section title="Organizers" description={`${ysws.organizerMemberships.length} organizer(s).`} divider={false}>
              <ServerTable
                columns={[
                  { key: "user", header: "Organizer", render: (m: typeof ysws.organizerMemberships[0]) => (
                    <Link href={`/admin/users/${m.user.id}`} className="font-medium hover:underline">
                      {m.user.name ?? m.user.email}
                    </Link>
                  ) },
                  { key: "email", header: "Email", render: (m: typeof ysws.organizerMemberships[0]) => m.user.email ?? "&mdash;" },
                  { key: "role", header: "Role", className: "w-28", render: (m: typeof ysws.organizerMemberships[0]) => (
                    <StatusBadge variant={m.role === "OWNER" ? "in-progress" : "ready"} label={m.role === "OWNER" ? "Owner" : "Organizer"} />
                  ) },
                  { key: "org", header: "Org", render: (m: typeof ysws.organizerMemberships[0]) => m.org?.name ?? "&mdash;" },
                ]}
                data={ysws.organizerMemberships}
                rowKey="id"
                emptyMessage="No organizers."
              />
            </Section>
          )}

          {/* Orders */}
          <Section title="Orders" description={`Showing latest ${ysws.orders.length} orders.`} divider={false}>
            {ysws.orders.length === 0 ? (
              <p className="text-govuk-grey-4">No orders yet.</p>
            ) : (
              <ServerTable
                columns={[
                  { key: "id", header: "Order", className: "w-24", render: (o: typeof ysws.orders[0]) => (
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm hover:underline">
                      {o.id.slice(0, 8)}&hellip;
                    </Link>
                  ) },
                  { key: "recipient", header: "Recipient", render: (o: typeof ysws.orders[0]) => o.recipientName ?? "&mdash;" },
                  { key: "state", header: "State", className: "w-36", render: (o: typeof ysws.orders[0]) => (
                    <StatusBadge variant={mapYSWSActiveToVariant(false)} label={o.currentState.replace(/_/g, " ")} />
                  ) },
                  { key: "fulfillment", header: "Fulfillment", className: "w-28", render: (o: typeof ysws.orders[0]) => (
                    <span className="govuk-tag govuk-tag--grey text-xs">{o.status}</span>
                  ) },
                  { key: "created", header: "Created", className: "w-28", render: (o: typeof ysws.orders[0]) => dateLabel(o.createdAt) },
                ]}
                data={ysws.orders}
                rowKey="id"
                emptyMessage="No orders."
              />
            )}
          </Section>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <Section title="Actions" divider={false}>
            <div className="space-y-3">
              <Link href="/admin/create-order" className="govuk-button w-full block text-center">
                Create passport order
              </Link>
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}
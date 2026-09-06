import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import { ROLE_LABEL, Role } from "@/lib/org";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";
import StatusBadge from "@/app/components/StatusBadge";
import { mapUserRoleToVariant } from "@/app/components/status-variant";
import ServerTable from "@/app/components/ServerTable";
import Link from "next/link";

function dateLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserWithRole();
  const { id } = await params;

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const isSuperadmin = user.role === "SUPERADMIN";

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: {
      orgs: { include: { org: { select: { name: true, slug: true, id: true } } } },
      organizerYSWSes: {
        include: {
          ysws: { select: { name: true, slug: true, isActive: true, id: true } },
          org: { select: { name: true, slug: true, id: true } },
        },
      },
      createdOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { org: { select: { name: true, id: true } }, ysws: { select: { name: true, id: true } } },
      },
      receivedOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { org: { select: { name: true, id: true } }, ysws: { select: { name: true, id: true } } },
      },
    },
  });

  if (!targetUser) {
    redirect("/admin/users");
  }

  const globalRoles = targetUser.role ? [targetUser.role] : [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "whoami", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Users & roles", href: "/admin/users" },
          { label: targetUser.name ?? targetUser.email ?? "User" },
        ]}
      />

      <PageHeader
        title={targetUser.name ?? targetUser.email ?? "User"}
        description={targetUser.email ?? undefined}
        backHref="/admin/users"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {/* Status & meta */}
          <Section title="Account" divider={false}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-govuk-grey-4">Status</dt>
                <dd className="mt-1 font-medium">
                  <StatusBadge variant={targetUser.emailVerified ? "active" : "inactive"} label={targetUser.emailVerified ? "Verified" : "Unverified"} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-govuk-grey-4">Global role</dt>
                <dd className="mt-1 font-medium">
                  <StatusBadge variant={mapUserRoleToVariant(targetUser.role as Role)} label={ROLE_LABEL[targetUser.role as Role]} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-govuk-grey-4">Joined</dt>
                <dd className="mt-1 font-medium">{dateLabel(targetUser.createdAt)}</dd>
              </div>
              {targetUser.slackId && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-govuk-grey-4">Slack ID</dt>
                  <dd className="mt-1 font-mono text-sm">{targetUser.slackId}</dd>
                </div>
              )}
              {targetUser.hcaId && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-govuk-grey-4">HCA ID</dt>
                  <dd className="mt-1 font-mono text-sm">{targetUser.hcaId}</dd>
                </div>
              )}
            </dl>
          </Section>

          {/* Global roles */}
          <Section title="Global roles" divider={false}>
            <ul className="space-y-2">
              {globalRoles.map((role) => (
                <li key={role} className="flex items-center gap-3">
                  <StatusBadge variant={mapUserRoleToVariant(role)} label={ROLE_LABEL[role as keyof typeof ROLE_LABEL]} />
                </li>
              ))}
            </ul>
          </Section>

          {/* YSWS memberships */}
          {targetUser.organizerYSWSes.length > 0 && (
            <Section title="YSWS memberships" divider={false}>
              <ServerTable
                columns={[
                  { key: "ysws", header: "YSWS", render: (m: typeof targetUser.organizerYSWSes[0]) => (
                    <Link href={`/admin/yswses/${m.yswsId}`} className="font-medium hover:underline">
                      {m.ysws?.name ?? "&mdash;"}
                    </Link>
                  ) },
                  { key: "org", header: "Org", render: (m: typeof targetUser.organizerYSWSes[0]) => m.org?.name ?? "&mdash;" },
                  { key: "role", header: "Role", render: (m: typeof targetUser.organizerYSWSes[0]) => (
                    <StatusBadge variant={m.role === "OWNER" ? "in-progress" : "ready"} label={m.role === "OWNER" ? "Owner" : "Organizer"} />
                  ), className: "w-28" },
                  { key: "active", header: "Active", render: (m: typeof targetUser.organizerYSWSes[0]) => (
                    <StatusBadge variant={m.ysws?.isActive ? "active" : "inactive"} label={m.ysws?.isActive ? "Yes" : "No"} />
                  ), className: "w-20" },
                ]}
                data={targetUser.organizerYSWSes}
                rowKey="id"
                emptyMessage="No YSWS memberships."
              />
            </Section>
          )}

          {/* Org memberships */}
          {targetUser.orgs.length > 0 && (
            <Section title="Org memberships" divider={false}>
              <ServerTable
                columns={[
                  { key: "org", header: "Org", render: (m: typeof targetUser.orgs[0]) => m.org?.name ?? "&mdash;" },
                  { key: "role", header: "Role", render: (m: typeof targetUser.orgs[0]) => (
                    <StatusBadge variant={m.role === "OWNER" ? "in-progress" : "ready"} label={m.role === "OWNER" ? "Owner" : "Organizer"} />
                  ), className: "w-28" },
                ]}
                data={targetUser.orgs}
                rowKey="id"
                emptyMessage="No org memberships."
              />
            </Section>
          )}

          {/* Created orders */}
          {targetUser.createdOrders.length > 0 && (
            <Section title="Created orders" description="Latest 10 orders created by this user." divider={false}>
              <ServerTable
                columns={[
                  { key: "id", header: "Order", render: (o: typeof targetUser.createdOrders[0]) => (
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm hover:underline">
                      {o.id.slice(0, 8)}&hellip;
                    </Link>
                  ) },
                  { key: "recipient", header: "Recipient", render: (o: typeof targetUser.createdOrders[0]) => o.recipientName ?? "&mdash;" },
                  { key: "ysws", header: "YSWS", render: (o: typeof targetUser.createdOrders[0]) => o.ysws?.name ?? o.org.name },
                  { key: "state", header: "State", render: (o: typeof targetUser.createdOrders[0]) => (
                    <StatusBadge variant={mapUserRoleToVariant("")} label={o.currentState.replace(/_/g, " ")} />
                  ), className: "w-36" },
                  { key: "created", header: "Created", render: (o: typeof targetUser.createdOrders[0]) => dateLabel(o.createdAt), className: "w-28" },
                ]}
                data={targetUser.createdOrders}
                rowKey="id"
                emptyMessage="No created orders."
              />
            </Section>
          )}

          {/* Received orders */}
          {targetUser.receivedOrders.length > 0 && (
            <Section title="Passport orders received" description="Latest 10 orders where this user is the recipient." divider={false}>
              <ServerTable
                columns={[
                  { key: "id", header: "Order", render: (o: typeof targetUser.receivedOrders[0]) => (
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm hover:underline">
                      {o.id.slice(0, 8)}&hellip;
                    </Link>
                  ) },
                  { key: "ysws", header: "YSWS", render: (o: typeof targetUser.receivedOrders[0]) => o.ysws?.name ?? o.org.name },
                  { key: "state", header: "State", render: (o: typeof targetUser.receivedOrders[0]) => (
                    <StatusBadge variant={mapUserRoleToVariant("")} label={o.currentState.replace(/_/g, " ")} />
                  ), className: "w-36" },
                  { key: "created", header: "Created", render: (o: typeof targetUser.receivedOrders[0]) => dateLabel(o.createdAt), className: "w-28" },
                ]}
                data={targetUser.receivedOrders}
                rowKey="id"
                emptyMessage="No received orders."
              />
            </Section>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <Section title="Actions" divider={false}>
            <div className="space-y-3">
              <Link href={`/admin/users/${id}/edit`} className="govuk-button govuk-button--secondary w-full block text-center">
                Edit user
              </Link>
              {isSuperadmin && (
                <Link href={`/admin/users/${id}/role`} className="govuk-button govuk-button--secondary w-full block text-center">
                  Change role
                </Link>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}
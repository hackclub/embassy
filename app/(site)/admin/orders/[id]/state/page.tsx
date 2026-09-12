import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";
import StatusBadge from "@/app/components/StatusBadge";
import { mapOrderStateToVariant } from "@/app/components/status-variant";
import OrderStateForm from "../OrderStateForm";

export default async function AdminOrderStatePage({
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
    select: { id: true, currentState: true, status: true },
  });

  if (!order) {
    redirect("/admin/orders");
  }

  const isTerminal = order.currentState === "DELIVERED";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Embassy", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Passport orders", href: "/admin/orders" },
          { label: `Order ${id.slice(0, 8)}...`, href: `/admin/orders/${id}` },
          { label: "Update state" },
        ]}
      />

      <PageHeader
        title="Update order state"
        description={`Change where order ${id.slice(0, 8)}... sits in the passport pipeline. Changes are recorded in the order activity feed.`}
        backHref={`/admin/orders/${id}`}
        backLabel="Back to order"
      />

      {isTerminal && (
        <div className="govuk-notification-banner govuk-notification-banner--warning mb-6">
          <p className="font-semibold">
            This order is already delivered. Updating the state will move it back
            into the pipeline and notify anyone watching the tracking page.
          </p>
        </div>
      )}

      <Section title="Current state" divider={false}>
        <div className="mb-6 flex items-center gap-3">
          <StatusBadge variant={mapOrderStateToVariant(order.currentState)} />
        </div>
        <OrderStateForm
          orderId={order.id}
          currentState={order.currentState}
          status={order.status}
        />
      </Section>
    </>
  );
}

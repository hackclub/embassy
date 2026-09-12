import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";
import OrderEditForm from "../OrderEditForm";

export default async function AdminOrderEditPage({
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
    select: {
      id: true,
      recipientName: true,
      recipientEmail: true,
      note: true,
      currentState: true,
    },
  });

  if (!order) {
    redirect("/admin/orders");
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Embassy", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Passport orders", href: "/admin/orders" },
          { label: `Order ${id.slice(0, 8)}...`, href: `/admin/orders/${id}` },
          { label: "Edit" },
        ]}
      />

      <PageHeader
        title="Edit order"
        description={`Update the recipient details for order ${id.slice(0, 8)}...`}
        backHref={`/admin/orders/${id}`}
        backLabel="Back to order"
      />

      <Section title="Order details" divider={false}>
        <OrderEditForm
          orderId={order.id}
          recipientName={order.recipientName ?? ""}
          recipientEmail={order.recipientEmail ?? ""}
          note={order.note ?? ""}
        />
      </Section>
    </>
  );
}

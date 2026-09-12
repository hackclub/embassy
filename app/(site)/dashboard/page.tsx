import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import FadeIn from "@/app/components/FadeIn";
import PageHeader from "@/app/components/PageHeader";
import { getCurrentUserWithRole, hasRole, ROLE_LABEL } from "@/lib/org";
import { getYSWSContext } from "@/lib/ysws-context";
import { prisma } from "@/lib/prisma";
import CreateOrderForm from "./CreateOrderForm";
import ApiIntegrationPanel from "./ApiIntegrationPanel";
import YSWSSelector from "./YSWSSelector";
import ServerTable from "@/app/components/ServerTable";
import StatusBadge from "@/app/components/StatusBadge";
import { mapOrderStateToVariant } from "@/app/components/status-variant";
import DashboardMobileSidebar from "./DashboardMobileSidebar";

function dateLabel(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ysws?: string }>;
}) {
  const user = await getCurrentUserWithRole();
  const params = await searchParams;
  const selectedYswsId = params.ysws ?? null;

  // Get unified YSWS context
  const context = await getYSWSContext();

  return (
    <FadeIn className="mx-auto w-full px-6 pb-12 pt-8">
      <Breadcrumb items={[{ label: "Embassy", href: "/" }, { label: "Dashboard" }]} />

      {!user ? (
        <UnsignedDashboard />
      ) : !hasRole(user.role, "ORGANIZER") ? (
        <NotOrganizer />
      ) : !context ? (
        <NoOrgAccess />
      ) : (
        <OrganizerDashboard 
          context={context} 
          selectedYswsId={selectedYswsId} 
        />
      )}
    </FadeIn>
  );
}

function UnsignedDashboard() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Organizer dashboard"
        description="Sign in with Hack Club to manage your YSWS and create passport orders."
        actions={
          <Link href="/api/auth/signin?callbackUrl=/dashboard" className="govuk-button">
            Sign in with Hack Club
          </Link>
        }
      />
    </div>
  );
}

function NotOrganizer() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Dashboard"
        description="You are signed in as a participant. If you run a YSWS and want to order passports, ask an admin to register you as an organizer."
        actions={
          <Link href="/" className="govuk-button govuk-button--secondary">
            Back home
          </Link>
        }
      />
    </div>
  );
}

function NoOrgAccess() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Dashboard"
        description="You are signed in as an organizer, but you are not linked to any YSWS yet. Ask an admin to register your YSWS and add you to it."
        actions={
          <Link href="/" className="govuk-button govuk-button--secondary">
            Back home
          </Link>
        }
      />
    </div>
  );
}

async function OrganizerDashboard({
  context,
  selectedYswsId,
}: {
  context: Awaited<ReturnType<typeof getYSWSContext>>;
  selectedYswsId?: string | null;
}) {
  if (!context) return <NoOrgAccess />;

  // Resolve current YSWS - validate server-side
  let activeYSWS = context.activeYSWS;
  if (selectedYswsId) {
    const selected = context.accessibleYSWSes.find((y) => y.yswsId === selectedYswsId);
    if (selected) activeYSWS = selected;
  }

  if (!activeYSWS) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title={context.accessibleYSWSes[0]?.orgName ?? "Dashboard"}
          description="No active YSWS selected. Please choose a YSWS from the switcher below."
        />
      </div>
    );
  }

  // Fetch orders for the selected YSWS
  const orders = await prisma.ySWS.findUnique({
    where: { id: activeYSWS.yswsId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { 
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const orderList = orders?.orders ?? [];
  const totalOrdered = orderList.reduce((sum, o) => sum + o.totalQuantity, 0);

  // Orders needing attention (awaiting details, pending, etc.)
  const needsAttention = orderList.filter((o) => 
    ["AWAITING_RECIPIENT_DETAILS", "RECIPIENT_DETAILS_RECEIVED", "DRAFTING", "ERROR"].includes(o.currentState)
  );

  const recentOrders = orderList.slice(0, 20);

  const orderRows = orderList.map((o) => ({
    id: o.id,
    recipientName: o.recipientName,
    recipientEmail: o.recipientEmail,
    currentState: o.currentState,
    createdAt: o.createdAt.toISOString(),
    note: o.note,
  }));

  return (
    <div className="min-h-screen bg-govuk-white">
      <header className="border-b border-govuk-grey-2 bg-govuk-white sticky top-0 z-10 min-h-[var(--dashboard-header-height)]">
        <div className="mx-auto max-w-full px-6 py-4">
          <nav className="flex items-center justify-between" aria-label="Global">
            <Link href="/" className="text-xl font-bold text-hc-red">Embassy</Link>
            <div className="flex items-center gap-4 text-sm text-govuk-grey-4">
              <span>Signed in as <strong>{activeYSWS.orgName}</strong></span>
              <span aria-hidden="true">·</span>
              <span>YSWS: <strong>{activeYSWS.yswsName}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Role: <strong>{ROLE_LABEL[context.role]}</strong></span>
              {hasRole(context.role, "ADMIN") && (
                <Link href="/admin" className="govuk-button govuk-button--secondary govuk-button--small">
                  Admin panel
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile sidebar toggle */}
      <DashboardMobileSidebar 
        activeYSWS={activeYSWS} 
        context={context} 
        totalOrdered={totalOrdered} 
      />

      <div className="mx-auto max-w-full px-6 py-6 md:grid md:grid-cols-[260px_1fr] md:gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="md:sticky md:top-[var(--dashboard-sidebar-sticky-offset)] md:self-start hidden md:block" aria-label="Dashboard navigation">
          <nav>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-govuk-grey-4">
              Dashboard
            </h2>
            <ul className="space-y-0.5" role="list">
              <li>
                <Link
                  href="/dashboard"
                  aria-current="page"
                  className="block border-l-4 px-3 py-1.5 text-sm border-govuk-blue bg-transparent font-semibold text-govuk-black"
                >
                  Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard?view=orders"
                  className="block border-l-4 px-3 py-1.5 text-sm border-transparent text-govuk-grey-4 hover:border-govuk-grey-2 hover:text-govuk-black"
                >
                  Orders
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard?view=api"
                  className="block border-l-4 px-3 py-1.5 text-sm border-transparent text-govuk-grey-4 hover:border-govuk-grey-2 hover:text-govuk-black"
                >
                  API integration
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
        <main className="w-full md:col-span-1 lg:col-span-1">
          {/* Page header */}
          <PageHeader
            title={activeYSWS.orgName}
            description={`YSWS: ${activeYSWS.yswsName} · You are a ${ROLE_LABEL[context.role].toLowerCase()}${totalOrdered > 0 ? ` · Total orders: ${totalOrdered}` : ""}`}
            backHref="/dashboard"
          />

          {/* YSWS Switcher - prominent if multiple */}
          {context.accessibleYSWSes.length > 1 && (
            <YSWSSelector 
              yswsList={context.accessibleYSWSes} 
              currentYswsId={activeYSWS.yswsId} 
            />
          )}

          {/* Orders needing attention */}
          {needsAttention.length > 0 && (
            <div className="mb-6 p-4 border-2 border-govuk-yellow bg-govuk-white">
              <h2 className="govuk-heading-m mb-3">Orders needing attention ({needsAttention.length})</h2>
              <p className="mb-4 text-govuk-grey-4">These orders require action to move forward.</p>
              <ServerTable
                columns={[
                  {
                    key: "recipient",
                    header: "Recipient",
                    render: (o: typeof orderRows[0]) => (
                      <div className="font-medium">
                        {o.recipientName ?? "&mdash;"}
                        {o.recipientEmail && <span className="block text-xs text-govuk-grey-4">{o.recipientEmail}</span>}
                      </div>
                    ),
                  },
                  {
                    key: "state",
                    header: "Status",
                    className: "w-40",
                    render: (o: typeof orderRows[0]) => (
                      <StatusBadge variant={mapOrderStateToVariant(o.currentState)} />
                    ),
                  },
                  {
                    key: "created",
                    header: "Created",
                    className: "w-32 whitespace-nowrap",
                    render: (o: typeof orderRows[0]) => dateLabel(o.createdAt),
                  },
                ]}
                data={orderRows.filter((o) => 
                  ["AWAITING_RECIPIENT_DETAILS", "RECIPIENT_DETAILS_RECEIVED", "DRAFTING", "ERROR"].includes(o.currentState)
                )}
                rowKey="id"
                emptyMessage="No orders needing attention."
              />
            </div>
          )}

          {/* Create order form */}
          <section className="mb-8">
            <h2 className="govuk-heading-m mb-2">Create passport order</h2>
            <p className="mb-4 text-govuk-grey-4">Each order is for one participant. Enter their details and we&apos;ll handle the rest.</p>
            <CreateOrderForm orgId={activeYSWS.orgId} yswsId={activeYSWS.yswsId} />
          </section>

          {/* Recent orders */}
          <section>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="govuk-heading-m">Recent orders</h2>
                <p className="text-govuk-grey-4">Showing latest {recentOrders.length} of {orderList.length} total orders for this YSWS.</p>
              </div>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-govuk-grey-4">No orders yet. Create your first order above.</p>
            ) : (
              <ServerTable
                columns={[
                  {
                    key: "recipient",
                    header: "Recipient",
                    render: (o: typeof orderRows[0]) => (
                      <div className="font-medium">
                        {o.recipientName ?? "&mdash;"}
                        {o.recipientEmail && <span className="block text-xs text-govuk-grey-4">{o.recipientEmail}</span>}
                      </div>
                    ),
                  },
                  {
                    key: "state",
                    header: "Status",
                    className: "w-40",
                    render: (o: typeof orderRows[0]) => (
                      <StatusBadge variant={mapOrderStateToVariant(o.currentState)} />
                    ),
                  },
                  {
                    key: "created",
                    header: "Created",
                    className: "w-32 whitespace-nowrap",
                    render: (o: typeof orderRows[0]) => dateLabel(o.createdAt),
                  },
                  {
                    key: "note",
                    header: "Note",
                    render: (o: typeof orderRows[0]) => o.note ? (
                      <span className="text-govuk-grey-4 text-sm max-w-xs block truncate">{o.note}</span>
                    ) : (
                      <span className="text-govuk-grey-4 text-sm">&mdash;</span>
                    ),
                  },
                ]}
                data={orderRows}
                rowKey="id"
                emptyMessage="No orders yet."
              />
            )}
          </section>
        </main>
      </div>

      <aside className="lg:col-span-4 space-y-6">
        <ApiIntegrationPanel 
          orgId={activeYSWS.orgId} 
          yswsId={activeYSWS.yswsId}
          apiKeyDisplay={activeYSWS.yswsApiKeyDisplay} 
          yswsName={activeYSWS.yswsName}
        />
      </aside>
    </div>
  );
}
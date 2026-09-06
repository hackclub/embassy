"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";
import StatusBadge from "@/app/components/StatusBadge";
import { mapOrderStateToVariant } from "@/app/components/status-variant";

type OrderRow = {
  id: string;
  recipientName: string | null;
  org: { name: string };
  ysws: { name: string } | null;
  currentState: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  createdAt: string;
  eventType: string;
  orderId: string;
  order: { org: { name: string } | null; recipientName: string | null };
};

function dateLabel(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function datetimeLabel(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

interface AdminOverviewClientProps {
  stats: {
    orgCount: number;
    orderCount: number;
    organizerCount: number;
    userCount: number;
  };
  recentOrders: OrderRow[];
  recentEvents: EventRow[];
}

export default function AdminOverviewClient({
  stats,
  recentOrders,
  recentEvents,
}: AdminOverviewClientProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "activity">("orders");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Combined data for the orders tab
  const ordersData = useMemo(() => {
    return recentOrders.filter((o) => {
      const name = (o.recipientName ?? "").toLowerCase();
      const id = o.id.toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || id.includes(search.toLowerCase());
      const matchesState = !stateFilter || o.currentState === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [recentOrders, search, stateFilter]);

  const totalPages = Math.ceil(ordersData.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return ordersData.slice(start, start + pageSize);
  }, [ordersData, currentPage]);

  const hasActiveFilters = Boolean(search || stateFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.status !== undefined) setStateFilter(values.status);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStateFilter("");
    setCurrentPage(1);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "whoami", href: "/" }, { label: "Admin" }]} />

      <PageHeader
        title="Admin"
        description="Overview of YSWS passport operations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/create-order" className="govuk-button">
              Create passport order
            </Link>
            <Link href="/admin/register-organizer" className="govuk-button govuk-button--secondary">
              Register organiser
            </Link>
            <Link href="/admin/users" className="govuk-button govuk-button--secondary">
              Manage users & roles
            </Link>
          </div>
        }
      />

      {/* Summary stats - GOV.UK summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 border-2 border-govuk-grey-2">
          <p className="text-sm text-govuk-grey-4">YSWS organisations</p>
          <p className="text-3xl font-bold"><Link href="/admin/yswses" className="hover:underline">{stats.orgCount}</Link></p>
        </div>
        <div className="p-4 border-2 border-govuk-grey-2">
          <p className="text-sm text-govuk-grey-4">Organisers</p>
          <p className="text-3xl font-bold"><Link href="/admin/organizers" className="hover:underline">{stats.organizerCount}</Link></p>
        </div>
        <div className="p-4 border-2 border-govuk-grey-2">
          <p className="text-sm text-govuk-grey-4">Total passport orders</p>
          <p className="text-3xl font-bold"><Link href="/admin/orders" className="hover:underline">{stats.orderCount}</Link></p>
        </div>
        <div className="p-4 border-2 border-govuk-grey-2">
          <p className="text-sm text-govuk-grey-4">Registered users</p>
          <p className="text-3xl font-bold"><Link href="/admin/users" className="hover:underline">{stats.userCount}</Link></p>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="mb-6 border-b border-govuk-grey-2" aria-label="Admin sections">
        <ul className="flex gap-1" role="tablist">
          <li role="presentation">
            <button
              role="tab"
              aria-selected={activeTab === "orders"}
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "orders"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-grey-4 hover:text-govuk-black"
              }`}
            >
              Passport orders ({ordersData.length})
            </button>
          </li>
          <li role="presentation">
            <button
              role="tab"
              aria-selected={activeTab === "activity"}
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "activity"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-grey-4 hover:text-govuk-black"
              }`}
            >
              Activity ({recentEvents.length})
            </button>
          </li>
        </ul>
      </nav>

      {activeTab === "orders" && (
        <>
          {/* Filters */}
          <FilterBar
            filters={[
              { key: "search", label: "Search", type: "search", placeholder: "Search by recipient name or order ID" },
              {
                key: "status",
                label: "State",
                type: "select",
                options: [
                  { value: "AWAITING_RECIPIENT_DETAILS", label: "Awaiting details" },
                  { value: "RECIPIENT_DETAILS_RECEIVED", label: "Details received" },
                  { value: "DRAFTING", label: "Drafting" },
                  { value: "DRAFT_READY", label: "Draft ready" },
                  { value: "SENT_TO_HQ", label: "Sent to HQ" },
                  { value: "RECEIVED_FROM_HQ", label: "Received from HQ" },
                  { value: "SHIPPING", label: "Shipping" },
                  { value: "DELIVERED", label: "Delivered" },
                  { value: "CANCELLED", label: "Cancelled" },
                  { value: "ERROR", label: "Error" },
                ],
              },
            ]}
            values={{ search, status: stateFilter }}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Results count */}
          <p className="mb-4 text-sm text-govuk-grey-4">
            Showing {paginatedOrders.length} of {ordersData.length} orders
            {hasActiveFilters && <span> (filtered)</span>}
          </p>

          {/* Orders table */}
          <DataTable
            columns={[
              {
                key: "when",
                header: "When",
                sortable: true,
                className: "w-24 whitespace-nowrap",
                render: (o: OrderRow) => dateLabel(o.createdAt),
              },
              {
                key: "recipient",
                header: "Recipient",
                sortable: true,
                render: (o: OrderRow) => (
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                    {o.recipientName ?? "&mdash;"}
                  </Link>
                ),
              },
              {
                key: "ysws",
                header: "YSWS",
                sortable: true,
                render: (o: OrderRow) => o.ysws?.name ?? o.org.name,
              },
              {
                key: "state",
                header: "State",
                sortable: true,
                className: "w-36",
                render: (o: OrderRow) => (
                  <StatusBadge variant={mapOrderStateToVariant(o.currentState)} />
                ),
              },
            ]}
            data={paginatedOrders}
            rowKey="id"
            emptyMessage="No orders found."
            showPagination={true}
            pageSize={pageSize}
            initialSortKey="createdAt"
            initialSortDirection="desc"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <p className="text-sm text-govuk-grey-4">
                Page {currentPage} of {totalPages} ({ordersData.length} results)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="govuk-button govuk-button--secondary govuk-button--small"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="govuk-button govuk-button--secondary govuk-button--small"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {activeTab === "activity" && (
        <>
          <p className="mb-4 text-sm text-govuk-grey-4">
            Showing {recentEvents.length} recent events
          </p>
          <DataTable
            columns={[
              {
                key: "when",
                header: "When",
                sortable: true,
                className: "w-36 whitespace-nowrap",
                render: (e: EventRow) => datetimeLabel(e.createdAt),
              },
              {
                key: "type",
                header: "Event",
                sortable: true,
                className: "w-28",
                render: (e: EventRow) => (
                  <span className="govuk-tag govuk-tag--grey text-xs">{e.eventType.replace(/_/g, " ")}</span>
                ),
              },
              {
                key: "order",
                header: "Order",
                sortable: true,
                render: (e: EventRow) => (
                  <Link href={`/admin/orders/${e.orderId}`} className="font-mono text-sm hover:underline">
                    {e.orderId.slice(0, 8)}…
                  </Link>
                ),
              },
              {
                key: "ysws",
                header: "Org",
                sortable: true,
                render: (e: EventRow) => e.order.org?.name ?? "—",
              },
            ]}
            data={recentEvents}
            rowKey="id"
            emptyMessage="No activity recorded yet."
            showPagination={false}
            initialSortKey="createdAt"
            initialSortDirection="desc"
          />
        </>
      )}
    </>
  );
}
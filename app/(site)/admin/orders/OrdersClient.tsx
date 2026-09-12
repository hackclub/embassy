"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";
import StatusBadge from "@/app/components/StatusBadge";
import {
  mapOrderStateToVariant,
  mapFulfillmentStatusToVariant,
} from "@/app/components/status-variant";

type OrderRow = {
  id: string;
  recipientName: string | null;
  recipientEmail: string | null;
  org: { name: string };
  ysws: { id: string; name: string } | null;
  currentState: string;
  status: string;
  createdAt: string;
};

const NEEDS_ATTENTION_STATES = [
  "AWAITING_RECIPIENT_DETAILS",
  "RECIPIENT_DETAILS_RECEIVED",
  "DRAFTING",
  "ERROR",
];

export default function AdminOrdersClient({
  initialOrders,
  initialYswses,
}: {
  initialOrders: OrderRow[];
  initialYswses: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yswsFilter, setYswsFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((o) => {
      const name = (o.recipientName ?? "").toLowerCase();
      const email = (o.recipientEmail ?? "").toLowerCase();
      const id = o.id.toLowerCase();
      const matchesSearch = !search ||
        name.includes(search.toLowerCase()) ||
        email.includes(search.toLowerCase()) ||
        id.includes(search.toLowerCase());
      const matchesStatus = !statusFilter || o.currentState === statusFilter;
      const matchesYsws = !yswsFilter || o.ysws?.id === yswsFilter;
      const matchesFulfillment = !fulfillmentFilter || o.status === fulfillmentFilter;
      const matchesNeedsAttention = !needsAttentionFilter || NEEDS_ATTENTION_STATES.includes(o.currentState);
      return matchesSearch && matchesStatus && matchesYsws && matchesFulfillment && matchesNeedsAttention;
    });
  }, [initialOrders, search, statusFilter, yswsFilter, fulfillmentFilter, needsAttentionFilter]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  const hasActiveFilters = Boolean(search || statusFilter || yswsFilter || fulfillmentFilter || needsAttentionFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.status !== undefined) setStatusFilter(values.status);
    if (values.ysws !== undefined) setYswsFilter(values.ysws);
    if (values.fulfillment !== undefined) setFulfillmentFilter(values.fulfillment);
    if (values.needsAttention !== undefined) setNeedsAttentionFilter(values.needsAttention === "true");
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setYswsFilter("");
    setFulfillmentFilter("");
    setNeedsAttentionFilter(false);
    setCurrentPage(1);
  };

  function dateLabel(d: string) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(d));
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Embassy", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Passport orders" }]} />

      <PageHeader
        title="Passport orders"
        description={`Showing ${paginatedOrders.length} of ${filteredOrders.length} orders.`}
        actions={
          <Link href="/admin/create-order" className="govuk-button">
            Create passport order
          </Link>
        }
      />

      {/* Filters */}
      <FilterBar
        filters={[
          { key: "search", label: "Search", type: "search", placeholder: "Search by name, email, order ID" },
          {
            key: "status",
            label: "State",
            type: "select",
            options: [
              { value: "needs-attention", label: "Needs attention" },
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
          {
            key: "ysws",
            label: "YSWS",
            type: "select",
            options: initialYswses.map((y) => ({ value: y.id, label: y.name })),
          },
          {
            key: "fulfillment",
            label: "Fulfillment",
            type: "select",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "SHIPPED", label: "Shipped" },
            ],
          },
        ]}
        values={{
          search,
          status: statusFilter,
          ysws: yswsFilter,
          fulfillment: fulfillmentFilter,
          needsAttention: needsAttentionFilter ? "true" : "",
        }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Results count */}
      <p className="mb-4 text-sm text-govuk-grey-4">
        Showing {paginatedOrders.length} of {filteredOrders.length} orders
        {hasActiveFilters && <span> (filtered)</span>}
      </p>

      {/* All orders table */}
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
            className: "w-44 align-top",
            render: (o: OrderRow) => (
              <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                {o.recipientName ?? "&mdash;"}
              </Link>
            ),
          },
          {
            key: "email",
            header: "Email",
            className: "max-w-56 truncate",
            render: (o: OrderRow) => (
              <span className="block truncate text-sm text-govuk-grey-4" title={o.recipientEmail ?? undefined}>
                {o.recipientEmail ?? "—"}
              </span>
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
          {
            key: "fulfillment",
            header: "Fulfillment",
            sortable: true,
            className: "w-28",
            render: (o: OrderRow) => (
              <StatusBadge variant={mapFulfillmentStatusToVariant(o.status)} />
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
            Page {currentPage} of {totalPages} ({filteredOrders.length} results)
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
  );
}
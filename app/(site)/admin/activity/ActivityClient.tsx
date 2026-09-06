"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";

type EventRow = {
  id: string;
  createdAt: string;
  eventType: string;
  orderId: string;
  order: { org: { name: string } | null; recipientName: string | null; yswsId: string | null };
  newState: string | null;
  actor: string;
  actorType: string | null;
  description: string | null;
};

function datetimeLabel(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export default function AdminActivityClient({
  initialEvents,
}: {
  initialEvents: EventRow[];
}) {
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const eventTypes = useMemo(() => {
    const types = new Set(initialEvents.map((e) => e.eventType));
    return Array.from(types).sort();
  }, [initialEvents]);

  const actorTypes = useMemo(() => {
    const types = new Set(initialEvents.map((e) => e.actorType).filter((t): t is string => Boolean(t)));
    return Array.from(types).sort();
  }, [initialEvents]);

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((e) => {
      const id = e.orderId.toLowerCase();
      const recipient = (e.order.recipientName ?? "").toLowerCase();
      const matchesSearch = !search || id.includes(search.toLowerCase()) || recipient.includes(search.toLowerCase());
      const matchesEventType = !eventTypeFilter || e.eventType === eventTypeFilter;
      const matchesActorType = !actorTypeFilter || e.actorType === actorTypeFilter;
      return matchesSearch && matchesEventType && matchesActorType;
    });
  }, [initialEvents, search, eventTypeFilter, actorTypeFilter]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  const hasActiveFilters = Boolean(search || eventTypeFilter || actorTypeFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.eventType !== undefined) setEventTypeFilter(values.eventType);
    if (values.actorType !== undefined) setActorTypeFilter(values.actorType);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setEventTypeFilter("");
    setActorTypeFilter("");
    setCurrentPage(1);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "whoami", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Audit log" }]} />

      <PageHeader
        title="Audit log"
        description="All system events and administrative actions."
      />

      <FilterBar
        filters={[
          { key: "search", label: "Search", type: "search", placeholder: "Search by order ID or recipient" },
          {
            key: "eventType",
            label: "Event type",
            type: "select",
            options: eventTypes.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
          },
          {
            key: "actorType",
            label: "Actor type",
            type: "select",
            options: actorTypes.map((t) => ({ value: t, label: t })),
          },
        ]}
        values={{ search, eventType: eventTypeFilter, actorType: actorTypeFilter }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <p className="mb-4 text-sm text-govuk-grey-4">
        Showing {paginatedEvents.length} of {filteredEvents.length} events
        {hasActiveFilters && <span> (filtered)</span>}
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
            className: "w-32",
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
                {e.order.recipientName && <span className="block text-xs text-govuk-grey-4">{e.order.recipientName}</span>}
              </Link>
            ),
          },
          {
            key: "ysws",
            header: "YSWS",
            sortable: true,
            render: (e: EventRow) => e.order.org?.name ?? "—",
          },
          {
            key: "state",
            header: "State",
            sortable: true,
            className: "w-36",
            render: (e: EventRow) => e.newState ? (
              <span className="govuk-tag govuk-tag--blue text-xs">{e.newState.replace(/_/g, " ")}</span>
            ) : "—",
          },
          {
            key: "actor",
            header: "Actor",
            sortable: true,
            className: "w-32",
            render: (e: EventRow) => (
              <>
                <span className="font-mono text-xs">{e.actor.slice(0, 8)}…</span>
                <span className="block text-xs text-govuk-grey-4">{e.actorType ?? "—"}</span>
              </>
            ),
          },
          {
            key: "description",
            header: "Details",
            sortable: true,
            render: (e: EventRow) => e.description ?? "—",
          },
        ]}
        data={paginatedEvents}
        rowKey="id"
        emptyMessage="No events recorded yet."
        showPagination={true}
        pageSize={pageSize}
        initialSortKey="createdAt"
        initialSortDirection="desc"
      />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-govuk-grey-4">
            Page {currentPage} of {totalPages} ({filteredEvents.length} results)
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
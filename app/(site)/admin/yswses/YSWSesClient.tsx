"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";
import StatusBadge from "@/app/components/StatusBadge";
import { mapYSWSActiveToVariant } from "@/app/components/status-variant";

type YSWSRow = {
  id: string;
  name: string;
  slug: string;
  org: { id: string; name: string } | null;
  isActive: boolean;
  _count: { orders: number; organizerMemberships: number };
};

export default function AdminYSWSesClient({
  initialYSWSes,
}: {
  initialYSWSes: YSWSRow[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filteredYSWSes = useMemo(() => {
    return initialYSWSes.filter((y) => {
      const name = (y.name ?? "").toLowerCase();
      const slug = (y.slug ?? "").toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || slug.includes(search.toLowerCase());
      const matchesStatus = !statusFilter || (statusFilter === "active" && y.isActive) || (statusFilter === "inactive" && !y.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [initialYSWSes, search, statusFilter]);

  const totalPages = Math.ceil(filteredYSWSes.length / pageSize);
  const paginatedYSWSes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredYSWSes.slice(start, start + pageSize);
  }, [filteredYSWSes, currentPage]);

  const hasActiveFilters = Boolean(search || statusFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.status !== undefined) setStatusFilter(values.status);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Embassy", href: "/" }, { label: "Admin", href: "/admin" }, { label: "YSWSes" }]} />

      <PageHeader
        title="YSWS organisations"
        description={`${filteredYSWSes.length} of ${initialYSWSes.length} registered.`}
        actions={
          <Link href="/admin/register-organizer" className="govuk-button">
            Register YSWS
          </Link>
        }
      />

      <FilterBar
        filters={[
          { key: "search", label: "Search", type: "search", placeholder: "Search by name or slug" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        values={{ search, status: statusFilter }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <p className="mb-4 text-sm text-govuk-grey-4">
        Showing {paginatedYSWSes.length} of {filteredYSWSes.length} YSWSes
        {hasActiveFilters && <span> (filtered)</span>}
      </p>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            render: (y: YSWSRow) => (
              <Link href={`/admin/yswses/${y.id}`} className="font-medium hover:underline">
                {y.name}
              </Link>
            ),
          },
          {
            key: "slug",
            header: "Slug",
            sortable: true,
            className: "w-36 font-mono text-sm",
            render: (y: YSWSRow) => y.slug,
          },
          {
            key: "org",
            header: "Org",
            sortable: true,
            render: (y: YSWSRow) => y.org?.name ?? "&mdash;",
          },
          {
            key: "active",
            header: "Active",
            sortable: true,
            className: "w-20 text-center",
            render: (y: YSWSRow) => (
              <StatusBadge variant={mapYSWSActiveToVariant(y.isActive)} label={y.isActive ? "Yes" : "No"} />
            ),
          },
          {
            key: "organizers",
            header: "Organisers",
            sortable: true,
            className: "w-24 text-right",
            render: (y: YSWSRow) => y._count.organizerMemberships,
          },
          {
            key: "orders",
            header: "Orders",
            sortable: true,
            className: "w-20 text-right",
            render: (y: YSWSRow) => y._count.orders,
          },
        ]}
        data={paginatedYSWSes}
        rowKey="id"
        emptyMessage="No YSWSes found."
        showPagination={true}
        pageSize={pageSize}
        initialSortKey="name"
        initialSortDirection="asc"
      />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-govuk-grey-4">
            Page {currentPage} of {totalPages} ({filteredYSWSes.length} results)
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
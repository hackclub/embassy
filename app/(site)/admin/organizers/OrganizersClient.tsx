"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";
import StatusBadge from "@/app/components/StatusBadge";
import { mapUserRoleToVariant } from "@/app/components/status-variant";

type OrganizerRow = {
  id: string;
  user: { id: string; name: string | null; email: string | null; role: string };
  org: { id: string; name: string };
  role: string;
};

export default function AdminOrganizersClient({
  initialOrganizers,
}: {
  initialOrganizers: OrganizerRow[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [yswsFilter, setYswsFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filteredOrganizers = useMemo(() => {
    return initialOrganizers.filter((m) => {
      const name = (m.user.name ?? "").toLowerCase();
      const email = (m.user.email ?? "").toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
      const matchesRole = !roleFilter || m.role === roleFilter;
      const matchesYsws = !yswsFilter || m.org.id === yswsFilter;
      return matchesSearch && matchesRole && matchesYsws;
    });
  }, [initialOrganizers, search, roleFilter, yswsFilter]);

  const totalPages = Math.ceil(filteredOrganizers.length / pageSize);
  const paginatedOrganizers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrganizers.slice(start, start + pageSize);
  }, [filteredOrganizers, currentPage]);

  const hasActiveFilters = Boolean(search || roleFilter || yswsFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.role !== undefined) setRoleFilter(values.role);
    if (values.ysws !== undefined) setYswsFilter(values.ysws);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter("");
    setYswsFilter("");
    setCurrentPage(1);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "whoami", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Organisers" }]} />

      <PageHeader
        title="Organisers"
        description={`${filteredOrganizers.length} of ${initialOrganizers.length} organisers across all YSWSes.`}
        actions={
          <Link href="/admin/register-organizer" className="govuk-button">
            Register organiser
          </Link>
        }
      />

      <FilterBar
        filters={[
          { key: "search", label: "Search", type: "search", placeholder: "Search by name or email" },
          {
            key: "role",
            label: "Org role",
            type: "select",
            options: [
              { value: "OWNER", label: "Owner" },
              { value: "ORGANIZER", label: "Organiser" },
            ],
          },
        ]}
        values={{ search, role: roleFilter, ysws: yswsFilter }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <p className="mb-4 text-sm text-govuk-grey-4">
        Showing {paginatedOrganizers.length} of {filteredOrganizers.length} organisers
        {hasActiveFilters && <span> (filtered)</span>}
      </p>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            render: (m: OrganizerRow) => (
              <Link href={`/admin/users/${m.user.id}`} className="font-medium hover:underline">
                {m.user.name ?? m.user.email}
              </Link>
            ),
          },
          {
            key: "email",
            header: "Email",
            sortable: true,
            render: (m: OrganizerRow) => m.user.email ?? "&mdash;",
          },
          {
            key: "globalRole",
            header: "Global role",
            sortable: true,
            className: "w-36",
            render: (m: OrganizerRow) => (
              <StatusBadge variant={mapUserRoleToVariant(m.user.role)} label={m.user.role} />
            ),
          },
          {
            key: "orgRole",
            header: "Org role",
            sortable: true,
            className: "w-28 text-center",
            render: (m: OrganizerRow) => (
              <StatusBadge variant={m.role === "OWNER" ? "in-progress" : "ready"} label={m.role === "OWNER" ? "Owner" : "Organiser"} />
            ),
          },
          {
            key: "org",
            header: "YSWS org",
            sortable: true,
            render: (m: OrganizerRow) => (
              <Link href={`/admin/yswses/${m.org.id}`} className="hover:underline">
                {m.org.name}
              </Link>
            ),
          },
        ]}
        data={paginatedOrganizers}
        rowKey="id"
        emptyMessage="No organisers found."
        showPagination={true}
        pageSize={pageSize}
        initialSortKey="org"
        initialSortDirection="asc"
      />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-govuk-grey-4">
            Page {currentPage} of {totalPages} ({filteredOrganizers.length} results)
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
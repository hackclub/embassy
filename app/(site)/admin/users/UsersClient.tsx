"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import PageHeader from "@/app/components/PageHeader";
import DataTable from "@/app/components/DataTable";
import FilterBar from "@/app/components/FilterBar";
import StatusBadge from "@/app/components/StatusBadge";
import { mapUserRoleToVariant } from "@/app/components/status-variant";
import { ROLE_LABEL } from "@/lib/roles";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  slackId: string | null;
  hcaId: string | null;
  createdAt: string;
  _count: { createdOrders: number; orgs: number };
};

export default function AdminUsersClient({
  initialUsers,
}: {
  initialUsers: UserRow[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filteredUsers = useMemo(() => {
    return initialUsers.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [initialUsers, search, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  const hasActiveFilters = Boolean(search || roleFilter);

  const handleFilterChange = (values: Record<string, string>) => {
    if (values.search !== undefined) setSearch(values.search);
    if (values.role !== undefined) setRoleFilter(values.role);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter("");
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
      <Breadcrumb items={[{ label: "whoami", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Users & roles" }]} />

      <PageHeader
        title="Users & roles"
        description={`${filteredUsers.length} of ${initialUsers.length} registered accounts.`}
        actions={
          <Link href="/admin/users/new" className="govuk-button">
            Add user
          </Link>
        }
      />

      {/* Filters - GOV.UK filter pattern */}
      <FilterBar
        filters={[
          { key: "search", label: "Search", type: "search", placeholder: "Search by name or email" },
          {
            key: "role",
            label: "Global role",
            type: "select",
            options: [
              { value: "PARTICIPANT", label: "Participant" },
              { value: "ORGANIZER", label: "Organizer" },
              { value: "ADMIN", label: "Admin" },
              { value: "SUPERADMIN", label: "Superadmin" },
            ],
          },
        ]}
        values={{ search, role: roleFilter }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Results count */}
      <p className="mb-4 text-sm text-govuk-grey-4">
        Showing {paginatedUsers.length} of {filteredUsers.length} users
        {hasActiveFilters && <span> (filtered)</span>}
      </p>

      {/* Users table - main focus */}
      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            render: (u: UserRow) => (
              <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                {u.name ?? "&mdash;"}
              </Link>
            ),
          },
          {
            key: "email",
            header: "Email",
            sortable: true,
            render: (u: UserRow) => u.email ?? "&mdash;",
          },
          {
            key: "role",
            header: "Global role",
            sortable: true,
            className: "w-36",
            render: (u: UserRow) => (
              <StatusBadge variant={mapUserRoleToVariant(u.role)} label={ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]} />
            ),
          },
          {
            key: "slackId",
            header: "Slack ID",
            sortable: true,
            className: "w-36 font-mono text-sm",
            render: (u: UserRow) => u.slackId ?? "&mdash;",
          },
          {
            key: "hcaId",
            header: "HCA ID",
            sortable: true,
            className: "w-36 font-mono text-sm",
            render: (u: UserRow) => u.hcaId ?? "&mdash;",
          },
          {
            key: "orders",
            header: "Created orders",
            sortable: true,
            className: "w-28 text-right",
            render: (u: UserRow) => u._count.createdOrders,
          },
          {
            key: "orgs",
            header: "Org memberships",
            sortable: true,
            className: "w-28 text-right",
            render: (u: UserRow) => u._count.orgs,
          },
          {
            key: "created",
            header: "Joined",
            sortable: true,
            className: "w-32 whitespace-nowrap",
            render: (u: UserRow) => dateLabel(u.createdAt),
          },
        ]}
        data={paginatedUsers}
        rowKey="id"
        emptyMessage="No users found."
        showPagination={true}
        pageSize={pageSize}
        initialSortKey="createdAt"
        initialSortDirection="desc"
      />

      {/* Pagination - GOV.UK pattern */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-govuk-grey-4">
            Page {currentPage} of {totalPages} ({filteredUsers.length} results)
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
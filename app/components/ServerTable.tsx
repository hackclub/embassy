import { ChevronUpIcon, ChevronDownIcon } from "lucide-react";

type ServerColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  width?: string;
};

type ServerTableProps<T> = {
  columns: ServerColumn<T>[];
  data: T[];
  rowKey?: string;
  className?: string;
  emptyMessage?: string;
  sortable?: boolean;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
};

// Server-renderable table for RSC pages — accepts render functions because it
// never crosses the server/client boundary. For interactive sorting/filtering
// inside client components, use DataTable instead.
export default function ServerTable<T>({
  columns,
  data,
  rowKey = "id",
  className = "",
  emptyMessage = "No data.",
  sortable = false,
  sortKey = null,
  sortDirection = "asc",
}: ServerTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-govuk-grey-4">
        {emptyMessage}
      </div>
    );
  }

  const sortedData = sortable && sortKey ? [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortKey];
    const bVal = (b as Record<string, unknown>)[sortKey];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDirection === "asc" ? comparison : -comparison;
  }) : data;

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left" role="grid">
          <thead>
            <tr className="border-b-2 border-govuk-black">
              {columns.map((col) => (
                <th key={col.key} className={`py-2 pr-4 font-bold ${col.className ?? ""}`}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {sortable && sortKey === col.key && (
                      sortDirection === "asc"
                        ? <ChevronUpIcon className="w-4 h-4 inline-block" aria-hidden="true" />
                        : <ChevronDownIcon className="w-4 h-4 inline-block" aria-hidden="true" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr
                key={(row as Record<string, unknown>)[rowKey] as string}
                className="border-b border-govuk-grey-2 align-top"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 pr-4 ${col.className ?? ""} ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : ""}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-4">
        {sortedData.map((row) => (
          <div
            key={(row as Record<string, unknown>)[rowKey] as string}
            className="border-2 border-govuk-black bg-govuk-grey-1 p-4"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between gap-4 py-1 border-b border-govuk-grey-2 last:border-0">
                <dt className="text-sm font-medium text-govuk-grey-4 w-1/3 truncate min-w-0">
                  {col.header}
                </dt>
                <dd className="text-sm font-medium text-govuk-black w-2/3 text-right break-words min-w-0">
                  {col.render(row)}
                </dd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

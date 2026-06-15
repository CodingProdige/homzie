import Link from "next/link";
import type { ReactNode } from "react";

import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";

export type CanonicalTableColumn<T> = {
  className?: string;
  header: ReactNode;
  key: string;
  render: (row: T) => ReactNode;
  useRowHref?: boolean;
};

export function CanonicalTable<T>({
  columns,
  className,
  emptyState = "No records found.",
  getRowHref,
  getRowKey,
  minWidth = "760px",
  pagination,
  rows,
  tableClassName,
}: {
  className?: string;
  columns: Array<CanonicalTableColumn<T>>;
  emptyState?: ReactNode;
  getRowHref?: (row: T) => string;
  getRowKey: (row: T) => string;
  minWidth?: string;
  pagination?: {
    currentPage: number;
    hrefForPage: (page: number) => string;
    manual?: boolean;
    pageSize: number;
    totalItems?: number;
  };
  rows: T[];
  tableClassName?: string;
}) {
  const totalItems = pagination?.totalItems ?? rows.length;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(totalItems / pagination.pageSize))
    : 1;
  const currentPage = pagination
    ? Math.min(Math.max(pagination.currentPage, 1), totalPages)
    : 1;
  const visibleRows = pagination && !pagination.manual
    ? rows.slice((currentPage - 1) * pagination.pageSize, currentPage * pagination.pageSize)
    : rows;

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
        {emptyState}
      </div>
    );
  }

  return (
    <>
      <div className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}>
        <div className="overflow-x-auto">
          <table
            className={cn("w-full border-separate border-spacing-0 text-left text-sm", tableClassName)}
            style={{ minWidth }}
          >
            <thead className="bg-muted/50 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={cn("px-4 py-3", column.className)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const href = getRowHref?.(row);

                return (
                  <tr
                    key={getRowKey(row)}
                    className={cn(
                      "border-t border-border",
                      href && "group/row transition-colors hover:bg-muted/40",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-t border-border px-4 py-4 align-middle",
                          column.className,
                        )}
                      >
                        {href && column.useRowHref !== false ? (
                          <Link
                            href={href}
                            className="block min-h-8 text-inherit outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                          >
                            {column.render(row)}
                          </Link>
                        ) : (
                          column.render(row)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {pagination ? (
        <Pagination
          currentPage={currentPage}
          hrefForPage={pagination.hrefForPage}
          totalPages={totalPages}
        />
      ) : null}
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PaginationProps = {
  alwaysShow?: boolean;
  currentPage: number;
  hrefForPage?: (page: number) => string;
  onPageChange?: (page: number) => void;
  totalPages: number;
};

function pageWindow(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((first, second) => first - second);
}

export function Pagination({
  alwaysShow = false,
  currentPage,
  hrefForPage,
  onPageChange,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1 && !alwaysShow) return null;

  const pages = pageWindow(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <PaginationControl
        disabled={currentPage <= 1}
        href={hrefForPage?.(Math.max(currentPage - 1, 1))}
        onClick={onPageChange ? () => onPageChange(Math.max(currentPage - 1, 1)) : undefined}
      >
        <ChevronLeft className="size-4" />
        Previous
      </PaginationControl>

      {pages.map((page, index) => {
        const previousPage = pages[index - 1];
        const showGap = previousPage && page - previousPage > 1;

        return (
          <span key={page} className="contents">
            {showGap ? (
              <span className="grid h-10 min-w-10 place-items-center text-sm font-black text-muted-foreground">
                ...
              </span>
            ) : null}
            <PaginationControl
              href={hrefForPage?.(page)}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={onPageChange ? () => onPageChange(page) : undefined}
              className={cn(
                "grid h-10 min-w-10 place-items-center rounded-md border border-border bg-card px-3 text-sm font-black text-card-foreground transition hover:bg-muted",
                page === currentPage &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {page}
            </PaginationControl>
          </span>
        );
      })}

      <PaginationControl
        disabled={currentPage >= totalPages}
        href={hrefForPage?.(Math.min(currentPage + 1, totalPages))}
        onClick={onPageChange ? () => onPageChange(Math.min(currentPage + 1, totalPages)) : undefined}
      >
        Next
        <ChevronRight className="size-4" />
      </PaginationControl>
    </nav>
  );
}

function PaginationControl({
  children,
  className,
  disabled,
  href,
  onClick,
  ...props
}: {
  "aria-current"?: "page";
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-black text-card-foreground transition hover:bg-muted",
    disabled && "pointer-events-none opacity-45",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href || "#"} aria-disabled={disabled} className={classes} {...props}>
      {children}
    </Link>
  );
}

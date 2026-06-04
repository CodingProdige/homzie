import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PaginationProps = {
  currentPage: number;
  hrefForPage: (page: number) => string;
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
  currentPage,
  hrefForPage,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <Link
        href={hrefForPage(Math.max(currentPage - 1, 1))}
        aria-disabled={currentPage <= 1}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-black text-card-foreground transition hover:bg-muted",
          currentPage <= 1 && "pointer-events-none opacity-45",
        )}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Link>

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
            <Link
              href={hrefForPage(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={cn(
                "grid h-10 min-w-10 place-items-center rounded-md border border-border bg-card px-3 text-sm font-black text-card-foreground transition hover:bg-muted",
                page === currentPage &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {page}
            </Link>
          </span>
        );
      })}

      <Link
        href={hrefForPage(Math.min(currentPage + 1, totalPages))}
        aria-disabled={currentPage >= totalPages}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-black text-card-foreground transition hover:bg-muted",
          currentPage >= totalPages && "pointer-events-none opacity-45",
        )}
      >
        Next
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}

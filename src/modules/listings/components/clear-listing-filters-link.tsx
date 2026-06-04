"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

const propertySearchSessionKey = "homzie.propertySearch.filters";

type ClearListingFiltersLinkProps = {
  href: string;
};

export function ClearListingFiltersLink({ href }: ClearListingFiltersLinkProps) {
  return (
    <Button asChild className="mt-5">
      <Link
        href={href}
        onClick={() => {
          window.sessionStorage.removeItem(propertySearchSessionKey);
        }}
      >
        Clear filters and view all
      </Link>
    </Button>
  );
}

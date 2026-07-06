"use client";

import { Button } from "@/components/ui/button";

export function InvoicePrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      Print invoice
    </Button>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Link2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NetworkSearchOption = {
  id: string;
  name: string;
  region: string | null;
  slug: string;
};

export function NetworkSearchPicker({
  options,
}: {
  options: NetworkSearchOption[];
}) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selectedNetwork = options.find((option) => option.id === selectedId) || null;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.name, option.slug, option.region]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [options, query]);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <input type="hidden" name="networkAgencyId" value={selectedId} />
      <div className="relative grid gap-2 text-sm font-bold">
        <span>Select Network HQ</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedNetwork?.name || "Search existing networks"}
            className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-20 text-sm font-semibold outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-label="Search Network HQs"
            role="combobox"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {selectedNetwork ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedId("");
                  setQuery("");
                  setIsOpen(true);
                }}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                aria-label="Clear selected network"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              aria-label="Show networks"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        </div>

        {selectedNetwork ? (
          <div className="flex min-h-8 items-center gap-2 rounded-md bg-primary/8 px-3 py-2 text-xs font-black text-primary">
            <Check className="size-4" />
            <span className="truncate">
              Selected {selectedNetwork.name}
              {selectedNetwork.region ? ` · ${selectedNetwork.region}` : ""}
            </span>
          </div>
        ) : null}

        {isOpen ? (
          <div
            className="absolute left-0 right-0 top-[76px] z-20 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.id === selectedId;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSelectedId(option.id);
                      setQuery(option.name);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      isSelected && "bg-primary/10 text-primary",
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                      {option.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">
                        {option.name}
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">
                        {option.region || "Network HQ"} · {option.slug}
                      </span>
                    </span>
                    {isSelected ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm font-semibold text-muted-foreground">
                No Network HQ matches that search.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Button type="submit" className="self-start lg:self-end" disabled={!selectedId}>
        <Link2 className="size-4" />
        Request link
      </Button>
    </div>
  );
}

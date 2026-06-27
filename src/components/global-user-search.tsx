"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type UserSearchResult = {
  avatarUrl: string | null;
  name: string;
  username: string;
};

const globalSearchSessionKey = "homzie.globalSearch.query";

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

function userSearchResults(value: unknown): UserSearchResult[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is UserSearchResult => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;

    const result = item as Partial<UserSearchResult>;

    return (
      typeof result.name === "string" &&
      typeof result.username === "string" &&
      (typeof result.avatarUrl === "string" || result.avatarUrl === null)
    );
  });
}

export function GlobalUserSearchTrigger({
  className,
  display = "icon",
  onOpen,
}: {
  className?: string;
  display?: "icon" | "menu-item";
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";

    return window.sessionStorage.getItem(globalSearchSessionKey) || "";
  });
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.sessionStorage.setItem(globalSearchSessionKey, query);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let controller: AbortController | null = null;
    const timeout = window.setTimeout(() => {
      const trimmedQuery = query.trim();

      if (trimmedQuery.length < 2) {
        setResults([]);
        setStatus("idle");
        return;
      }

      controller = new AbortController();
      setStatus("loading");

      fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: unknown) => {
          if (!payload || typeof payload !== "object") {
            setResults([]);
            setStatus("error");
            return;
          }

          const nextResults = (payload as { users?: unknown }).users;

          setResults(userSearchResults(nextResults));
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setResults([]);
          setStatus("error");
        });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller?.abort();
    };
  }, [open, query]);

  return (
    <>
      <Button
        variant="ghost"
        size={display === "icon" ? "icon" : "default"}
        className={
          className ||
          (display === "menu-item"
            ? "flex min-h-12 w-full justify-start rounded-md px-3 text-base font-semibold"
            : undefined)
        }
        aria-label="Search users"
        aria-expanded={open}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <Search className="size-5" />
        {display === "menu-item" ? <span>Search</span> : null}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[120] bg-black/20 text-foreground backdrop-blur-[1px]">
          <div className="border-b border-border/70 bg-background shadow-lg">
            <div className="mx-auto flex h-20 w-full max-w-3xl items-center gap-2 px-3 sm:px-4">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search usernames"
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent text-base font-normal outline-none placeholder:text-muted-foreground"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close search"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="absolute inset-0 top-20 -z-10 cursor-default"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          />

          <div className="mx-auto w-full max-w-3xl px-3 pt-3 sm:px-4">
            <div className="overflow-hidden rounded-lg border border-border bg-background shadow-xl">
              {query.trim().length < 2 ? (
                <p className="px-4 py-5 text-sm font-normal text-muted-foreground">
                  Type at least 2 characters to search usernames.
                </p>
              ) : status === "loading" ? (
                <p className="px-4 py-5 text-sm font-normal text-muted-foreground">
                  Searching...
                </p>
              ) : status === "error" ? (
                <p className="px-4 py-5 text-sm font-normal text-muted-foreground">
                  Search is unavailable right now.
                </p>
              ) : results.length ? (
                <div className="divide-y divide-border">
                  {results.map((user) => (
                    <Link
                      key={user.username}
                      href={`/users/${user.username}`}
                      className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      onClick={() => setOpen(false)}
                    >
                      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--homzie-gradient)] p-0.5">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.name}
                            width={44}
                            height={44}
                            className="size-full rounded-full border-2 border-background object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center rounded-full border-2 border-background bg-brand-midnight text-sm font-semibold text-white">
                            {initialsFromName(user.name)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          @{user.username}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm font-normal text-muted-foreground">
                  No users found.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

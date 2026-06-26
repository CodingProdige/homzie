"use client";

type ErrorBoundaryName = "app" | "global";

export function reportClientErrorBoundary({
  boundary,
  error,
}: {
  boundary: ErrorBoundaryName;
  error: Error & { digest?: string };
}) {
  const path =
    typeof window === "undefined"
      ? null
      : `${window.location.pathname}${window.location.search}`;

  return fetch("/api/error-logs/client", {
    body: JSON.stringify({
      boundary,
      digest: error.digest || null,
      message: error.message || null,
      path,
      stack: error.stack || null,
    }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch((reportError) => {
    console.error("[error-logs] client boundary report failed", reportError);
  });
}

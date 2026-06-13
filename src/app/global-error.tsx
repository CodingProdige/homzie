"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#fbfbff",
          color: "#10101a",
          display: "flex",
          fontFamily:
            "Poppins, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main
          style={{
            background: "#ffffff",
            border: "1px solid #e5e2ef",
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(13, 13, 20, 0.08)",
            maxWidth: 640,
            padding: 32,
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "rgba(124, 92, 255, 0.12)",
              borderRadius: 999,
              color: "#7c5cff",
              display: "inline-flex",
              fontSize: 28,
              height: 64,
              justifyContent: "center",
              width: 64,
            }}
          >
            !
          </div>
          <p
            style={{
              color: "#7c5cff",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.18em",
              margin: "24px 0 0",
              textTransform: "uppercase",
            }}
          >
            Homzie
          </p>
          <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "12px 0 0" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "#686878",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.7,
              margin: "18px auto 0",
              maxWidth: 480,
            }}
          >
            The app hit an unexpected error while loading this page. Please try
            again, or return home and reopen the page.
          </p>
          {error.digest ? (
            <p
              style={{
                background: "#f2f0f7",
                borderRadius: 8,
                color: "#686878",
                fontSize: 12,
                fontWeight: 700,
                margin: "18px auto 0",
                maxWidth: 420,
                padding: "10px 12px",
              }}
            >
              Error reference: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              marginTop: 28,
            }}
          >
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                background: "linear-gradient(90deg, #5b32ff, #f24cc8)",
                border: 0,
                borderRadius: 8,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                minHeight: 44,
                padding: "0 18px",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                alignItems: "center",
                border: "1px solid #e5e2ef",
                borderRadius: 8,
                color: "#10101a",
                display: "inline-flex",
                fontSize: 14,
                fontWeight: 800,
                minHeight: 44,
                padding: "0 18px",
                textDecoration: "none",
              }}
            >
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

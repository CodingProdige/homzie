import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { errorLogs } from "@/db/schema";

const sensitiveMetadataKeyPattern =
  /(authorization|cookie|credential|password|private|secret|session|token|webhook|api[_-]?key)/i;
const maxMetadataDepth = 4;
const maxMetadataArrayLength = 25;
const maxMetadataObjectKeys = 40;
const maxMetadataStringLength = 1200;
const maxErrorMessageLength = 1200;
const maxErrorStackLength = 8000;

type ErrorLogSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type CaptureErrorLogInput = {
  action?: string;
  digest?: string;
  error: unknown;
  listingId?: string | null;
  metadata?: Record<string, unknown>;
  route?: string;
  severity?: ErrorLogSeverity;
  source?: string;
  stack?: string | null;
  stage?: string;
  userId?: string | null;
  username?: string | null;
};

export type CaptureClientErrorBoundaryInput = {
  boundary: "app" | "global";
  digest?: string | null;
  message?: string | null;
  path?: string | null;
  stack?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  username?: string | null;
};

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function getErrorProperty(error: unknown, key: string) {
  if (!error || typeof error !== "object" || !(key in error)) {
    return null;
  }

  const value = (error as Record<string, unknown>)[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return truncate(error.message, maxErrorMessageLength);
  }

  if (typeof error === "string" && error.trim()) {
    return truncate(error.trim(), maxErrorMessageLength);
  }

  return "Unknown error";
}

function errorStack(error: unknown) {
  if (error instanceof Error && error.stack) {
    return truncate(error.stack, maxErrorStackLength);
  }

  return null;
}

function errorDigest(error: unknown, explicitDigest?: string) {
  return explicitDigest || getErrorProperty(error, "digest");
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value === null) return null;

  if (typeof value === "string") {
    return truncate(value, maxMetadataStringLength);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= maxMetadataDepth) return "[array]";

    return value
      .slice(0, maxMetadataArrayLength)
      .map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= maxMetadataDepth) return "[object]";

    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      maxMetadataObjectKeys,
    );
    const sanitized: Record<string, unknown> = {};

    for (const [key, entryValue] of entries) {
      if (entryValue === undefined) continue;

      sanitized[key] = sensitiveMetadataKeyPattern.test(key)
        ? "[redacted]"
        : sanitizeMetadataValue(entryValue, depth + 1);
    }

    return sanitized;
  }

  if (typeof value === "undefined") {
    return null;
  }

  return String(value);
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {};

  return sanitizeMetadataValue(metadata, 0) as Record<string, unknown>;
}

export async function captureErrorLog(input: CaptureErrorLogInput) {
  const message = errorMessage(input.error);

  try {
    const [createdLog] = await db
      .insert(errorLogs)
      .values({
        action: input.action || null,
        digest: errorDigest(input.error, input.digest),
        listingId: input.listingId || null,
        message,
        metadata: sanitizeMetadata(input.metadata),
        route: input.route || null,
        severity: input.severity || "error",
        source: input.source || "server_action",
        stack: input.stack
          ? truncate(input.stack, maxErrorStackLength)
          : errorStack(input.error),
        stage: input.stage || null,
        userId: input.userId || null,
        username: input.username || null,
      })
      .returning({ id: errorLogs.id });

    return createdLog?.id || null;
  } catch (logError) {
    console.error("[error-logs] failed to capture error log", {
      logError,
      originalMessage: message,
      originalStage: input.stage,
    });

    return null;
  }
}

export async function captureClientErrorBoundaryLog(
  input: CaptureClientErrorBoundaryInput,
) {
  const clientMetadata = sanitizeMetadata({
    clientBoundary: {
      boundary: input.boundary,
      path: input.path,
      reportedAt: new Date(),
      userAgent: input.userAgent,
    },
  });
  const digest = input.digest?.trim() || null;

  if (digest) {
    try {
      const [existingLog] = await db
        .select({
          id: errorLogs.id,
          metadata: errorLogs.metadata,
          route: errorLogs.route,
          userId: errorLogs.userId,
          username: errorLogs.username,
        })
        .from(errorLogs)
        .where(eq(errorLogs.digest, digest))
        .orderBy(desc(errorLogs.createdAt))
        .limit(1);

      if (existingLog) {
        const existingMetadata =
          existingLog.metadata &&
          typeof existingLog.metadata === "object" &&
          !Array.isArray(existingLog.metadata)
            ? (existingLog.metadata as Record<string, unknown>)
            : {};

        await db
          .update(errorLogs)
          .set({
            metadata: {
              ...existingMetadata,
              ...clientMetadata,
            },
            route: existingLog.route || input.path || null,
            updatedAt: new Date(),
            userId: existingLog.userId || input.userId || null,
            username: existingLog.username || input.username || null,
          })
          .where(eq(errorLogs.id, existingLog.id));

        return existingLog.id;
      }
    } catch (error) {
      console.error("[error-logs] failed to attach client boundary context", {
        digest,
        error,
      });
    }
  }

  return captureErrorLog({
    action: "error_boundary",
    digest: digest || undefined,
    error: new Error(input.message || "Client error boundary rendered."),
    metadata: {
      clientBoundary: clientMetadata.clientBoundary,
    },
    route: input.path || undefined,
    severity: "error",
    source: "client_error_boundary",
    stack: input.stack || undefined,
    stage: input.boundary === "global" ? "global-error" : "app-error",
    userId: input.userId || null,
    username: input.username || null,
  });
}

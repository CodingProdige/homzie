import type { Instrumentation } from "next";

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  key: string,
) {
  const entry = Object.entries(headers).find(
    ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase(),
  );
  const value = entry?.[1];

  return Array.isArray(value) ? value.join(", ") : value || null;
}

function listingIdFromPath(path: string) {
  const match = path.match(
    /\/listings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$|\?)/i,
  );

  return match?.[1] || null;
}

function digestFromError(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) {
    return undefined;
  }

  const digest = (error as { digest?: unknown }).digest;

  return typeof digest === "string" ? digest : undefined;
}

async function userFromRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
) {
  const cookie = headerValue(headers, "cookie");

  if (!cookie || !process.env.AUTH_SECRET) {
    return { userId: null, username: null };
  }

  try {
    const [{ getToken }, { authSessionCookieName }] = await Promise.all([
      import("next-auth/jwt"),
      import("./modules/auth/session-cookie"),
    ]);
    type GetTokenRequest = Parameters<typeof getToken>[0]["req"];
    const tokenRequest = {
      headers: { cookie },
    } as unknown as GetTokenRequest;
    const token = await getToken({
      cookieName: authSessionCookieName,
      req: tokenRequest,
      secret: process.env.AUTH_SECRET,
    });

    return {
      userId: typeof token?.sub === "string" ? token.sub : null,
      username: typeof token?.username === "string" ? token.username : null,
    };
  } catch (error) {
    console.error("[instrumentation] could not read request user", error);

    return { userId: null, username: null };
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  try {
    const [{ captureErrorLog }, user] = await Promise.all([
      import("./modules/error-logs/server"),
      userFromRequestHeaders(request.headers),
    ]);
    const path = request.path || context.routePath;

    await captureErrorLog({
      action: `next_${context.routeType}`,
      digest: digestFromError(error),
      error,
      listingId: listingIdFromPath(path),
      metadata: {
        nextRequest: {
          method: request.method,
          path: request.path,
          referer: headerValue(request.headers, "referer"),
          routePath: context.routePath,
          routeType: context.routeType,
          routerKind: context.routerKind,
          userAgent: headerValue(request.headers, "user-agent"),
        },
        nextRender: {
          renderSource: context.renderSource,
          revalidateReason: context.revalidateReason,
        },
      },
      route: path,
      severity: "error",
      source: "next_request_error",
      stage: `${context.routeType}:${context.renderSource || "unknown"}`,
      userId: user.userId,
      username: user.username,
    });
  } catch (logError) {
    console.error("[instrumentation] request error capture failed", logError);
  }
};

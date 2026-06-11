import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Domains we'll proxy audio from for waveform analysis
const ALLOWED_HOSTNAMES = [
  "prod.jamendo.com",
  "mp3l.jamendo.com",
  "storage.jamendo.com",
  "cdn.freesound.org",
  "freesound.org",
];
const MAX_AUDIO_PROXY_BYTES = 30 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15000;

async function readLimitedArrayBuffer(response: Response) {
  const contentLength = Number(response.headers.get("content-length") || 0);

  if (contentLength > MAX_AUDIO_PROXY_BYTES) {
    throw new Error("Audio file is too large");
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_AUDIO_PROXY_BYTES) {
      throw new Error("Audio file is too large");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > MAX_AUDIO_PROXY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Audio file is too large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");

  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Protocol not allowed" }, { status: 403 });
  }

  const allowed = ALLOWED_HOSTNAMES.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
  );

  if (!allowed) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    res = await fetch(raw, {
      headers: { "User-Agent": "Homzie/1.0" },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream ${res.status}` },
      { status: 502 },
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await readLimitedArrayBuffer(res);
  } catch (error) {
    clearTimeout(timeout);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("too large")
            ? "Audio file is too large"
            : "Could not read audio",
      },
      { status: error instanceof Error && error.message.includes("too large") ? 413 : 502 },
    );
  }
  clearTimeout(timeout);
  const contentType = res.headers.get("content-type") ?? "audio/mpeg";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

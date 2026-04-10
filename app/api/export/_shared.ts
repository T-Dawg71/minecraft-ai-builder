import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "local";
  }

  return request.headers.get("x-real-ip") ?? "local";
}

export function applyExportRateLimit(request: NextRequest) {
  const now = Date.now();
  const key = getClientKey(request);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded for export endpoints. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  existing.count += 1;
  buckets.set(key, existing);
  return null;
}

export async function proxyExportRequest(request: NextRequest, endpoint: string) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const contentType = upstream.headers.get("content-type") || "";
      let message = `Backend error: ${upstream.status}`;

      if (contentType.includes("application/json")) {
        const errorData = await upstream.json().catch(() => ({}));
        message = errorData.detail || errorData.error || message;
      } else {
        const text = await upstream.text().catch(() => "");
        if (text) {
          message = text;
        }
      }

      return NextResponse.json(
        { error: message },
        { status: upstream.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );

    const disposition = upstream.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }

    const arrayBuffer = await upstream.arrayBuffer();
    return new NextResponse(arrayBuffer, { status: upstream.status, headers });
  } catch (error) {
    console.error(`Export proxy error for ${endpoint}:`, error);
    return NextResponse.json(
      { error: "Internal server error. Is the backend running?" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

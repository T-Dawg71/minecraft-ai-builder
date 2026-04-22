import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function generateETag(data: unknown): string {
  return `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const page = req.nextUrl.searchParams.get("page") || "1";
    const perPage = req.nextUrl.searchParams.get("per_page") || "20";

    const res = await fetch(`${BACKEND_URL}/history?page=${page}&per_page=${perPage}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Failed to fetch history" }, { status: res.status });
    }

    const data = await res.json();
    const etag = generateETag(data);
    const ifNoneMatch = req.headers.get("if-none-match");

    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    return NextResponse.json(data, {
      headers: {
        "ETag": etag,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Backend not available" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Failed to save" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Backend not available" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const res = await fetch(`${BACKEND_URL}/history`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Failed to clear" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Backend not available" }, { status: 500 });
  }
}
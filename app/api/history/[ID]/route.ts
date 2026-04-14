import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ID: string }> }) {
  try {
    const { ID } = await params;
    const res = await fetch(`${BACKEND_URL}/history/${ID}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Not found" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Backend not available" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ ID: string }> }) {
  try {
    const { ID } = await params;
    const res = await fetch(`${BACKEND_URL}/history/${ID}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Not found" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Backend not available" }, { status: 500 });
  }
}
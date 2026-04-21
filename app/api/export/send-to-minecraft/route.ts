import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${BACKEND_URL}/export/send-to-minecraft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || `Backend error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach backend. Is it running?" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      console.error("Backend generate-image error:", upstream.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || `Backend error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    const imageBase64: string =
      data.image ?? data.imageBase64 ?? data.base64 ?? "";

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image data in backend response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ image: imageBase64 });
  } catch (err) {
    console.error("generate-image route error:", err);
    return NextResponse.json(
      { error: "Internal server error. Is the backend running?" },
      { status: 500 }
    );
  }
}
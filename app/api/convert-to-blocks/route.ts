import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_base64, width, height, palette, dithering } = body;

    if (!image_base64 || typeof image_base64 !== "string") {
      return NextResponse.json(
        { error: "image_base64 is required" },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/convert-to-blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64,
        width: width || 64,
        height: height || 64,
        palette: palette || "full",
        dithering: dithering || false,
      }),
    });

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      console.error("Backend convert-to-blocks error:", upstream.status, errorData);
      return NextResponse.json(
        { error: errorData.detail || `Backend error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("convert-to-blocks route error:", err);
    return NextResponse.json(
      { error: "Internal server error. Is the backend running?" },
      { status: 500 }
    );
  }
}
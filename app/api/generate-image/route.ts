import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const UPSTREAM_TIMEOUT_MS = 10 * 60 * 1000;

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(req: NextRequest) {
  try {
    const { prompt, negative_prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, negative_prompt }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
    const message = err instanceof Error ? err.message : "";
    const cause =
      err && typeof err === "object" && "cause" in err
        ? (err as { cause?: { code?: string } }).cause
        : undefined;

    if (
      message.includes("Timeout") ||
      cause?.code === "UND_ERR_HEADERS_TIMEOUT"
    ) {
      return NextResponse.json(
        {
          error:
            "Image generation timed out while waiting for Stable Diffusion. Try a shorter prompt or lower steps.",
        },
        { status: 504 }
      );
    }

    console.error("generate-image route error:", err);
    return NextResponse.json(
      { error: "Internal server error. Is the backend running?" },
      { status: 500 }
    );
  }
}
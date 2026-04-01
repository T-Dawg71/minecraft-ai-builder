import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const apiKey = process.env.IMAGE_GEN_API_KEY;
    const apiUrl = process.env.IMAGE_GEN_API_URL;

    if (!apiKey || !apiUrl) {
      return NextResponse.json(
        { error: "Image generation service is not configured." },
        { status: 500 }
      );
    }

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("Upstream image gen error:", upstream.status, text);
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();

    // Normalize: support { image }, { imageBase64 }, or { base64 } from upstream
    const imageBase64: string =
      data.image ?? data.imageBase64 ?? data.base64 ?? "";

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image data in upstream response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ image: imageBase64 });
  } catch (err) {
    console.error("generate-image route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
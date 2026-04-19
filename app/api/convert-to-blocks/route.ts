import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

let cachedBlockColors: Record<string, number[]> | null = null;

function getBlockColorMap(): Record<string, number[]> {
  if (!cachedBlockColors) {
    const filePath = join(process.cwd(), "python", "data", "block_colors.json");
    const raw = readFileSync(filePath, "utf-8");
    const blocks = JSON.parse(raw) as { id: string; rgb: number[] }[];
    cachedBlockColors = {};
    for (const block of blocks) {
      cachedBlockColors[block.id] = block.rgb;
    }
  }
  return cachedBlockColors;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_base64, width, height, palette, dithering, brightness, contrast } = body;

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
        width: width || 32,
        height: height || 32,
        palette: palette || "full",
        dithering: dithering || false,
        brightness: typeof brightness === "number" ? brightness : 0,
        contrast: typeof contrast === "number" ? contrast : 0,
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
    console.log("BACKEND GRID SAMPLE:", data.grid?.[0]?.slice(0, 3));

    // Attach block colors to the response
    const colorMap = getBlockColorMap();
    data.colors = colorMap;

    return NextResponse.json(data);
  } catch (err) {
    console.error("convert-to-blocks route error:", err);
    return NextResponse.json(
      { error: "Internal server error. Is the backend running?" },
      { status: 500 }
    );
  }
}
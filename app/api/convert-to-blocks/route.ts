import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// ── Minecraft block palette ───────────────────────────────────────────────────
// Each entry: { name, color as [r, g, b] }
const PALETTE: { name: string; rgb: [number, number, number] }[] = [
  { name: "grass_block",    rgb: [106, 127,  57] },
  { name: "dirt",           rgb: [134,  96,  67] },
  { name: "stone",          rgb: [125, 125, 125] },
  { name: "sand",           rgb: [219, 207, 163] },
  { name: "gravel",         rgb: [162, 154, 154] },
  { name: "oak_log",        rgb: [106,  85,  52] },
  { name: "oak_planks",     rgb: [162, 130,  78] },
  { name: "oak_leaves",     rgb: [ 60,  95,  36] },
  { name: "water",          rgb: [ 64, 120, 175] },
  { name: "snow",           rgb: [249, 249, 249] },
  { name: "ice",            rgb: [145, 183, 207] },
  { name: "coal_ore",       rgb: [ 75,  75,  75] },
  { name: "iron_ore",       rgb: [136, 115,  97] },
  { name: "gold_ore",       rgb: [143, 140,  56] },
  { name: "diamond_ore",    rgb: [ 93, 168, 164] },
  { name: "redstone_ore",   rgb: [131,  45,  45] },
  { name: "obsidian",       rgb: [ 21,  17,  31] },
  { name: "lava",           rgb: [207,  98,  19] },
  { name: "netherrack",     rgb: [114,  50,  50] },
  { name: "glowstone",      rgb: [172, 140,  82] },
  { name: "soul_sand",      rgb: [ 84,  64,  51] },
  { name: "white_wool",     rgb: [233, 236, 236] },
  { name: "red_wool",       rgb: [161,  41,  39] },
  { name: "blue_wool",      rgb: [ 60,  68, 170] },
  { name: "yellow_wool",    rgb: [248, 197,  39] },
  { name: "green_wool",     rgb: [ 84, 109,  27] },
  { name: "black_wool",     rgb: [ 26,  22,  22] },
  { name: "orange_wool",    rgb: [240, 118,  19] },
  { name: "purple_wool",    rgb: [121,  42, 172] },
  { name: "cyan_wool",      rgb: [ 22, 156, 156] },
  { name: "pink_wool",      rgb: [237, 141, 172] },
  { name: "birch_planks",   rgb: [195, 179, 123] },
  { name: "spruce_planks",  rgb: [ 74,  52,  27] },
  { name: "cobblestone",    rgb: [110, 108, 108] },
  { name: "mossy_cobblestone", rgb: [ 90, 108,  82] },
  { name: "bricks",         rgb: [151,  90,  74] },
  { name: "bookshelf",      rgb: [161, 130,  78] },
  { name: "crafting_table", rgb: [122,  85,  51] },
  { name: "tnt",            rgb: [220,  50,  47] },
  { name: "sponge",         rgb: [195, 193,  65] },
];

// ── Nearest-color lookup (Euclidean distance in RGB) ──────────────────────────
function nearestBlock(r: number, g: number, b: number) {
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const entry of PALETTE) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = entry; }
  }
  return best;
}

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// ── Route ─────────────────────────────────────────────────────────────────────
const GRID_SIZE = 128;

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "image (base64) is required" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(image, "base64");

    // Resize to 128×128 and get raw RGB pixels
    const { data } = await sharp(buf)
      .resize(GRID_SIZE, GRID_SIZE, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Build 128×128 BlockGrid
    const grid = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowArr = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const idx = (row * GRID_SIZE + col) * 3;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const block = nearestBlock(r, g, b);
        rowArr.push({ name: block.name, color: toHex(block.rgb[0], block.rgb[1], block.rgb[2]) });
      }
      grid.push(rowArr);
    }

    return NextResponse.json({ grid });
  } catch (err) {
    console.error("convert-to-blocks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
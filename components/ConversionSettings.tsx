"use client";

import { useState, useCallback } from "react";
import PaletteBuilder from "@/components/PaletteBuilder";

// ── Palette definitions (DEV-175) ─────────────────────────────────────────────

export interface BlockPalette {
  name: string;
  blocks: { name: string; rgb: [number, number, number] }[];
}

export interface ConversionPaletteBlock {
  id: string;
  name: string;
  rgb: [number, number, number];
}

export const PRESETS: BlockPalette[] = [
  {
    name: "Full",
    blocks: [
      // Concrete — most saturated, best for bold colors
      { name: "minecraft:white_concrete",            rgb: [207, 213, 214] },
      { name: "minecraft:orange_concrete",           rgb: [224,  97,   0] },
      { name: "minecraft:magenta_concrete",          rgb: [169,  48, 159] },
      { name: "minecraft:light_blue_concrete",       rgb: [ 36, 137, 199] },
      { name: "minecraft:yellow_concrete",           rgb: [240, 175,  19] },
      { name: "minecraft:lime_concrete",             rgb: [ 94, 168,  24] },
      { name: "minecraft:pink_concrete",             rgb: [213, 101, 142] },
      { name: "minecraft:gray_concrete",             rgb: [ 54,  57,  61] },
      { name: "minecraft:light_gray_concrete",       rgb: [125, 125, 115] },
      { name: "minecraft:cyan_concrete",             rgb: [ 21, 119, 136] },
      { name: "minecraft:purple_concrete",           rgb: [100,  31, 156] },
      { name: "minecraft:blue_concrete",             rgb: [ 44,  46, 143] },
      { name: "minecraft:brown_concrete",            rgb: [ 96,  59,  31] },
      { name: "minecraft:green_concrete",            rgb: [ 73,  91,  36] },
      { name: "minecraft:red_concrete",              rgb: [142,  33,  33] },
      { name: "minecraft:black_concrete",            rgb: [  8,  10,  15] },
      // Concrete Powder — slightly lighter variants, fills in mid-tones
      { name: "minecraft:white_concrete_powder",     rgb: [225, 227, 220] },
      { name: "minecraft:orange_concrete_powder",    rgb: [227, 131,  32] },
      { name: "minecraft:magenta_concrete_powder",   rgb: [201,  99, 196] },
      { name: "minecraft:light_blue_concrete_powder",rgb: [ 74, 180, 213] },
      { name: "minecraft:yellow_concrete_powder",    rgb: [233, 218,  96] },
      { name: "minecraft:lime_concrete_powder",      rgb: [125, 191,  42] },
      { name: "minecraft:pink_concrete_powder",      rgb: [228, 153, 164] },
      { name: "minecraft:gray_concrete_powder",      rgb: [ 76,  81,  84] },
      { name: "minecraft:light_gray_concrete_powder",rgb: [154, 161, 161] },
      { name: "minecraft:cyan_concrete_powder",      rgb: [ 22, 177, 181] },
      { name: "minecraft:purple_concrete_powder",    rgb: [131,  56, 178] },
      { name: "minecraft:blue_concrete_powder",      rgb: [ 70,  73, 167] },
      { name: "minecraft:brown_concrete_powder",     rgb: [125,  84,  53] },
      { name: "minecraft:green_concrete_powder",     rgb: [ 97, 119,  44] },
      { name: "minecraft:red_concrete_powder",       rgb: [168,  54,  50] },
      { name: "minecraft:black_concrete_powder",     rgb: [ 26,  26,  29] },
      // Wool — slightly warmer/softer than concrete
      { name: "minecraft:white_wool",                rgb: [233, 236, 236] },
      { name: "minecraft:orange_wool",               rgb: [240, 118,  19] },
      { name: "minecraft:magenta_wool",              rgb: [189,  68, 179] },
      { name: "minecraft:light_blue_wool",           rgb: [ 58, 175, 217] },
      { name: "minecraft:yellow_wool",               rgb: [248, 197,  39] },
      { name: "minecraft:lime_wool",                 rgb: [113, 187,  27] },
      { name: "minecraft:pink_wool",                 rgb: [237, 141, 172] },
      { name: "minecraft:gray_wool",                 rgb: [ 62,  68,  71] },
      { name: "minecraft:light_gray_wool",           rgb: [142, 142, 134] },
      { name: "minecraft:cyan_wool",                 rgb: [ 22, 156, 156] },
      { name: "minecraft:purple_wool",               rgb: [121,  42, 172] },
      { name: "minecraft:blue_wool",                 rgb: [ 60,  68, 170] },
      { name: "minecraft:brown_wool",                rgb: [114,  71,  40] },
      { name: "minecraft:green_wool",                rgb: [ 84, 109,  27] },
      { name: "minecraft:red_wool",                  rgb: [160,  40,  35] },
      { name: "minecraft:black_wool",                rgb: [ 26,  22,  22] },
      // Terracotta — earthy mid-tones, great for skin/brown/orange ranges
      { name: "minecraft:white_terracotta",          rgb: [210, 178, 161] },
      { name: "minecraft:orange_terracotta",         rgb: [162,  84,  38] },
      { name: "minecraft:magenta_terracotta",        rgb: [149,  88, 108] },
      { name: "minecraft:light_blue_terracotta",     rgb: [113, 108, 137] },
      { name: "minecraft:yellow_terracotta",         rgb: [186, 133,  35] },
      { name: "minecraft:lime_terracotta",           rgb: [103, 117,  52] },
      { name: "minecraft:pink_terracotta",           rgb: [161,  78,  78] },
      { name: "minecraft:gray_terracotta",           rgb: [ 57,  42,  35] },
      { name: "minecraft:light_gray_terracotta",     rgb: [135, 107,  98] },
      { name: "minecraft:cyan_terracotta",           rgb: [ 87,  91,  91] },
      { name: "minecraft:purple_terracotta",         rgb: [118,  70,  86] },
      { name: "minecraft:blue_terracotta",           rgb: [ 74,  59,  91] },
      { name: "minecraft:brown_terracotta",          rgb: [ 77,  51,  35] },
      { name: "minecraft:green_terracotta",          rgb: [ 76,  83,  42] },
      { name: "minecraft:red_terracotta",            rgb: [143,  61,  46] },
      { name: "minecraft:black_terracotta",          rgb: [ 37,  22,  16] },
      // Special blocks — unique colors not covered by dyed blocks
      { name: "minecraft:emerald_block",             rgb: [ 79, 188,  73] },
      { name: "minecraft:redstone_block",            rgb: [175,  26,   5] },
      { name: "minecraft:lapis_block",               rgb: [ 29,  58, 139] },
      { name: "minecraft:gold_block",                rgb: [246, 208,  61] },
      { name: "minecraft:diamond_block",             rgb: [ 99, 219, 213] },
      { name: "minecraft:netherite_block",           rgb: [ 68,  63,  66] },
      { name: "minecraft:snow_block",                rgb: [249, 254, 254] },
      { name: "minecraft:obsidian",                  rgb: [ 21,  17,  31] },
      { name: "minecraft:slime_block",               rgb: [109, 182, 108] },
      { name: "minecraft:honey_block",               rgb: [201, 133,  38] },
      { name: "minecraft:sea_lantern",               rgb: [172, 209, 200] },
      { name: "minecraft:prismarine",                rgb: [ 99, 171, 158] },
      { name: "minecraft:dark_prismarine",           rgb: [ 51,  96,  76] },
    ],
  },
  {
    name: "Classic",
    blocks: [
      { name: "grass_block",   rgb: [106, 127,  57] },
      { name: "dirt",          rgb: [134,  96,  67] },
      { name: "stone",         rgb: [125, 125, 125] },
      { name: "oak_planks",    rgb: [162, 130,  78] },
      { name: "oak_leaves",    rgb: [ 60,  95,  36] },
      { name: "sand",          rgb: [219, 207, 163] },
      { name: "gravel",        rgb: [162, 154, 154] },
      { name: "water",         rgb: [ 64, 120, 175] },
      { name: "cobblestone",   rgb: [110, 108, 108] },
      { name: "bricks",        rgb: [151,  90,  74] },
    ],
  },
  {
    name: "Nether",
    blocks: [
      { name: "netherrack",    rgb: [114,  50,  50] },
      { name: "lava",          rgb: [207,  98,  19] },
      { name: "obsidian",      rgb: [ 21,  17,  31] },
      { name: "glowstone",     rgb: [172, 140,  82] },
      { name: "soul_sand",     rgb: [ 84,  64,  51] },
      { name: "nether_brick",  rgb: [ 68,  34,  34] },
      { name: "magma_block",   rgb: [144,  68,  29] },
      { name: "crimson_stem",  rgb: [143,  51,  74] },
      { name: "warped_stem",   rgb: [ 43, 104, 107] },
      { name: "blackstone",    rgb: [ 43,  38,  49] },
    ],
  },
  {
    name: "Snowy",
    blocks: [
      { name: "snow",          rgb: [249, 249, 249] },
      { name: "ice",           rgb: [145, 183, 207] },
      { name: "packed_ice",    rgb: [157, 197, 221] },
      { name: "blue_ice",      rgb: [116, 167, 209] },
      { name: "stone",         rgb: [125, 125, 125] },
      { name: "spruce_planks", rgb: [ 74,  52,  27] },
      { name: "spruce_leaves", rgb: [ 48,  70,  40] },
      { name: "gravel",        rgb: [162, 154, 154] },
      { name: "dirt",          rgb: [134,  96,  67] },
      { name: "white_wool",    rgb: [233, 236, 236] },
    ],
  },
  {
    name: "Desert",
    blocks: [
      { name: "sand",             rgb: [219, 207, 163] },
      { name: "sandstone",        rgb: [210, 196, 148] },
      { name: "smooth_sandstone", rgb: [224, 213, 166] },
      { name: "red_sand",         rgb: [190, 102,  33] },
      { name: "red_sandstone",    rgb: [181,  97,  31] },
      { name: "terracotta",       rgb: [152,  94,  67] },
      { name: "dead_bush",        rgb: [106,  75,  33] },
      { name: "cactus",           rgb: [ 88, 119,  51] },
      { name: "gravel",           rgb: [162, 154, 154] },
      { name: "stone",            rgb: [125, 125, 125] },
    ],
  },
  {
    name: "Wool Rainbow",
    blocks: [
      { name: "white_wool",  rgb: [233, 236, 236] },
      { name: "red_wool",    rgb: [161,  41,  39] },
      { name: "orange_wool", rgb: [240, 118,  19] },
      { name: "yellow_wool", rgb: [248, 197,  39] },
      { name: "green_wool",  rgb: [ 84, 109,  27] },
      { name: "blue_wool",   rgb: [ 60,  68, 170] },
      { name: "purple_wool", rgb: [121,  42, 172] },
      { name: "cyan_wool",   rgb: [ 22, 156, 156] },
      { name: "pink_wool",   rgb: [237, 141, 172] },
      { name: "black_wool",  rgb: [ 26,  22,  22] },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type GridSize = 32 | 64 | 128 | 256 | "custom";
export type DepthMode = "flat" | "relief";

export interface ConversionConfig {
  gridWidth:     number;
  gridHeight:    number;
  palette:       ConversionPaletteBlock[];
  palettePreset: string;
  mapArtMode:    boolean;
  dithering:     boolean;
  brightness:    number;
  contrast:      number;
  depth:         number;
  depthMode:     DepthMode;
}

export type ConversionSettingsData = ConversionConfig;

interface ConversionSettingsProps {
  settings:         ConversionSettingsData;
  onSettingsChange: (config: ConversionSettingsData) => void;
  onReconvert:      () => void;
  hasImage:         boolean;
  hasBlockData:     boolean;
  isConverting:     boolean;
}

interface SliderProps {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-mc-stone-500">
        <span className="uppercase tracking-widest">{label}</span>
        <span className={value !== 0 ? "text-mc-grass-700 font-bold" : ""}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full accent-mc-grass-500"
      />
      <div className="flex justify-between text-[10px] text-mc-stone-400">
        <span>{min}</span><span>0</span><span>+{max}</span>
      </div>
    </div>
  );
}

// ── Default config ────────────────────────────────────────────────────────────

function toPaletteBlocks(palette: BlockPalette): ConversionPaletteBlock[] {
  return palette.blocks.map((block) => ({
    id:   block.name,
    name: block.name,
    rgb:  block.rgb,
  }));
}

export const DEFAULT_SETTINGS: ConversionSettingsData = {
  gridWidth:     32,
  gridHeight:    32,
  palette:       toPaletteBlocks(PRESETS[0]),
  palettePreset: PRESETS[0].name,
  mapArtMode:    false,
  dithering:     false,
  brightness:    0,
  contrast:      0,
  depth:         1,
  depthMode:     "flat",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConversionSettings({
  settings,
  onSettingsChange,
  onReconvert,
  hasImage,
  hasBlockData,
  isConverting,
}: ConversionSettingsProps) {
  const [customSize, setCustomSize] = useState(String(settings.gridWidth));

  const patch = useCallback(
    (p: Partial<ConversionSettingsData>) => onSettingsChange({ ...settings, ...p }),
    [settings, onSettingsChange]
  );

  const sizeSelect: GridSize =
    settings.gridWidth === settings.gridHeight &&
    [32, 64, 128, 256].includes(settings.gridWidth as 32 | 64 | 128 | 256)
      ? (settings.gridWidth as 32 | 64 | 128 | 256)
      : "custom";

  const handleSizeChange = (val: GridSize) => {
    if (val !== "custom") {
      patch({ gridWidth: val, gridHeight: val });
      setCustomSize(String(val));
    }
  };

  const handleCustomSize = (raw: string) => {
    setCustomSize(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 8 && n <= 512) patch({ gridWidth: n, gridHeight: n });
  };

  return (
    <div className="flex flex-col gap-4 w-full font-mono text-sm rounded-md border-2 border-mc-stone-300 bg-mc-stone-100 p-4">

      {/* ── Grid size ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-mc-stone-500 uppercase tracking-widest">Grid Size</label>
        <div className="flex gap-2 flex-wrap">
          {([32, 64, 128, 256, "custom"] as GridSize[]).map(s => (
            <button
              key={s}
              onClick={() => handleSizeChange(s)}
              className={`px-3 py-1 rounded border text-xs transition-colors ${
                sizeSelect === s
                  ? "bg-mc-grass-500 border-mc-grass-500 text-white"
                  : "border-mc-stone-300 hover:bg-mc-stone-200 text-mc-stone-800"
              }`}
            >
              {s === "custom" ? "Custom" : `${s}×${s}`}
            </button>
          ))}
        </div>
        {sizeSelect === "custom" && (
          <input
            type="number" min={8} max={512} value={customSize}
            onChange={e => handleCustomSize(e.target.value)}
            placeholder="8–512"
            className="mt-1 w-28 rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
          />
        )}
      </div>

      {/* ── Palette ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-mc-stone-500 uppercase tracking-widest">Palette</label>
        <select
          value={settings.palettePreset}
          onChange={e => {
            const nextPalette = PRESETS.find(p => p.name === e.target.value) ?? PRESETS[0];
            patch({
              palettePreset: nextPalette.name,
              palette:       toPaletteBlocks(nextPalette),
            });
          }}
          className="rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
        >
          {PRESETS.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-1 mt-1 flex-wrap">
          {settings.palette.map(b => (
            <div
              key={b.name}
              title={b.name.replace(/_/g, " ")}
              className="w-5 h-5 rounded-sm border border-mc-stone-300"
              style={{ backgroundColor: `rgb(${b.rgb.join(",")})` }}
            />
          ))}
        </div>

        <PaletteBuilder
          selectedBlocks={settings.palette}
          onChange={(nextPalette, sourceLabel) => {
            if (nextPalette.length === 0) return;
            patch({
              palette:       nextPalette,
              palettePreset: sourceLabel ? `Custom: ${sourceLabel}` : "Custom",
            });
          }}
        />
      </div>

      {/* ── Dithering ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-mc-stone-500 uppercase tracking-widest">Dithering</span>
        <button
          onClick={() => patch({ dithering: !settings.dithering })}
          className={`px-3 py-1 rounded border text-xs transition-colors ${
            settings.dithering
              ? "bg-mc-grass-500 border-mc-grass-500 text-white"
              : "border-mc-stone-300 hover:bg-mc-stone-200 text-mc-stone-800"
          }`}
        >
          {settings.dithering ? "On" : "Off"}
        </button>
      </div>

      {/* ── Map Art Mode ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-mc-stone-500 uppercase tracking-widest">Map Art Mode</span>
        <button
          onClick={() => patch({ mapArtMode: !settings.mapArtMode })}
          className={`px-3 py-1 rounded border text-xs transition-colors ${
            settings.mapArtMode
              ? "bg-mc-grass-500 border-mc-grass-500 text-white"
              : "border-mc-stone-300 hover:bg-mc-stone-200 text-mc-stone-800"
          }`}
        >
          {settings.mapArtMode ? "On" : "Off"}
        </button>
      </div>

      {/* ── Brightness ── */}
      <Slider
        label="Brightness" value={settings.brightness} min={-100} max={100}
        onChange={v => patch({ brightness: v })}
      />

      {/* ── Contrast ── */}
      <Slider
        label="Contrast" value={settings.contrast} min={-100} max={100}
        onChange={v => patch({ contrast: v })}
      />

      {/* ── Extrusion Depth ── */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mc-stone-500">
          <span className="uppercase tracking-widest">Extrusion Depth</span>
          <span className={settings.depth > 1 ? "text-mc-grass-700 font-bold" : ""}>
            {settings.depth} block{settings.depth !== 1 ? "s" : ""}
          </span>
        </div>
        <input
          type="range" min={1} max={10} value={settings.depth}
          onChange={e => patch({ depth: +e.target.value })}
          className="w-full accent-mc-grass-500"
        />
        <div className="flex justify-between text-[10px] text-mc-stone-400">
          <span>1 (flat)</span><span>10</span>
        </div>
        {settings.depth > 1 && (
          <div className="flex gap-2 mt-1">
            {(["flat", "relief"] as DepthMode[]).map(m => (
              <button
                key={m}
                onClick={() => patch({ depthMode: m })}
                className={`px-3 py-1 rounded border text-xs capitalize transition-colors ${
                  settings.depthMode === m
                    ? "bg-mc-grass-500 border-mc-grass-500 text-white"
                    : "border-mc-stone-300 hover:bg-mc-stone-200 text-mc-stone-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Re-convert ── */}
      <button
        onClick={onReconvert}
        disabled={isConverting || !hasImage}
        className="mt-1 px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wide bg-mc-grass-500 text-white hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isConverting ? "Converting..." : hasBlockData ? "Re-convert" : "Convert to Blocks"}
      </button>

    </div>
  );
}
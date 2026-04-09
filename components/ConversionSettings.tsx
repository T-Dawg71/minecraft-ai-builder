"use client";

import { useState, useEffect, useCallback } from "react";

// ── Palette definitions (DEV-175) ─────────────────────────────────────────────

export interface BlockPalette {
  name: string;
  blocks: { name: string; rgb: [number, number, number] }[];
}

export const PRESETS: BlockPalette[] = [
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
  gridSize:   number;
  palette:    BlockPalette;
  dithering:  boolean;
  brightness: number;   // -100 to +100
  contrast:   number;   // -100 to +100
  depth:      number;   // 1-10
  depthMode:  DepthMode;
}

interface ConversionSettingsProps {
  onChange:    (config: ConversionConfig) => void;
  onReconvert: () => void;
  isLoading:   boolean;
}

// ── Default config ────────────────────────────────────────────────────────────

const DEFAULT: ConversionConfig = {
  gridSize:   128,
  palette:    PRESETS[0],
  dithering:  false,
  brightness: 0,
  contrast:   0,
  depth:      1,
  depthMode:  "flat",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConversionSettings({
  onChange,
  onReconvert,
  isLoading,
}: ConversionSettingsProps) {
  const [config,     setConfig]     = useState<ConversionConfig>(DEFAULT);
  const [customSize, setCustomSize] = useState("128");
  const [sizeSelect, setSizeSelect] = useState<GridSize>(128);

  // Notify parent on any change (DEV-180)
  useEffect(() => { onChange(config); }, [config, onChange]);

  const patch = useCallback((p: Partial<ConversionConfig>) =>
    setConfig(prev => ({ ...prev, ...p })), []);

  // ── Grid size (DEV-174) ───────────────────────────────────────────────────
  const handleSizeChange = (val: GridSize) => {
    setSizeSelect(val);
    if (val !== "custom") patch({ gridSize: val });
  };
  const handleCustomSize = (raw: string) => {
    setCustomSize(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 8 && n <= 512) patch({ gridSize: n });
  };

  // ── Slider helper ─────────────────────────────────────────────────────────
  const Slider = ({
    label, value, min, max,
    onChange: onSlide,
  }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-mc-stone-500">
        <span className="uppercase tracking-widest">{label}</span>
        <span className={value !== 0 ? "text-mc-grass-700 font-bold" : ""}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onSlide(+e.target.value)}
        className="w-full accent-mc-grass-500"
      />
      <div className="flex justify-between text-[10px] text-mc-stone-400">
        <span>{min}</span><span>0</span><span>+{max}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full font-mono text-sm rounded-md border-2 border-mc-stone-300 bg-mc-stone-100 p-4">

      {/* ── Grid size (DEV-174) ── */}
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

      {/* ── Palette (DEV-175) ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-mc-stone-500 uppercase tracking-widest">Palette</label>
        <select
          value={config.palette.name}
          onChange={e => patch({ palette: PRESETS.find(p => p.name === e.target.value)! })}
          className="rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
        >
          {PRESETS.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-1 mt-1 flex-wrap">
          {config.palette.blocks.map(b => (
            <div
              key={b.name}
              title={b.name.replace(/_/g, " ")}
              className="w-5 h-5 rounded-sm border border-mc-stone-300"
              style={{ backgroundColor: `rgb(${b.rgb.join(",")})` }}
            />
          ))}
        </div>
      </div>

      {/* ── Dithering (DEV-176) ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-mc-stone-500 uppercase tracking-widest">Dithering</span>
        <button
          onClick={() => patch({ dithering: !config.dithering })}
          className={`px-3 py-1 rounded border text-xs transition-colors ${
            config.dithering
              ? "bg-mc-grass-500 border-mc-grass-500 text-white"
              : "border-mc-stone-300 hover:bg-mc-stone-200 text-mc-stone-800"
          }`}
        >
          {config.dithering ? "On" : "Off"}
        </button>
      </div>

      {/* ── Brightness (DEV-177) ── */}
      <Slider
        label="Brightness" value={config.brightness} min={-100} max={100}
        onChange={v => patch({ brightness: v })}
      />

      {/* ── Contrast (DEV-178) ── */}
      <Slider
        label="Contrast" value={config.contrast} min={-100} max={100}
        onChange={v => patch({ contrast: v })}
      />

      {/* ── Depth (DEV-212) ── */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mc-stone-500">
          <span className="uppercase tracking-widest">Extrusion Depth</span>
          <span className={config.depth > 1 ? "text-mc-grass-700 font-bold" : ""}>
            {config.depth} block{config.depth !== 1 ? "s" : ""}
          </span>
        </div>
        <input
          type="range" min={1} max={10} value={config.depth}
          onChange={e => patch({ depth: +e.target.value })}
          className="w-full accent-mc-grass-500"
        />
        <div className="flex justify-between text-[10px] text-mc-stone-400">
          <span>1 (flat)</span><span>10</span>
        </div>
        {config.depth > 1 && (
          <div className="flex gap-2 mt-1">
            {(["flat", "relief"] as DepthMode[]).map(m => (
              <button
                key={m}
                onClick={() => patch({ depthMode: m })}
                className={`px-3 py-1 rounded border text-xs capitalize transition-colors ${
                  config.depthMode === m
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

      {/* ── Re-convert (DEV-179) ── */}
      <button
        onClick={onReconvert}
        disabled={isLoading}
        className="mt-1 px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wide bg-mc-grass-500 text-white hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? "Converting..." : "Re-convert"}
      </button>

    </div>
  );
}
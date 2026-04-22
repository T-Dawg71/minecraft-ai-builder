"use client";

import { useCallback, useState, useEffect, memo } from "react";

// ── Palette definitions ───────────────────────────────────────────────────────

export interface BlockPalette {
  name: string;
  blocks: { name: string; rgb: [number, number, number] }[];
}

export interface ConversionPaletteBlock {
  id: string;
  name: string;
  rgb: [number, number, number];
}

export const FULL_PALETTE: BlockPalette = {
  name: "Full",
  blocks: [
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
};

export const PRESETS: BlockPalette[] = [FULL_PALETTE];

// ── Types ─────────────────────────────────────────────────────────────────────

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
  // Local string state so the box can be fully cleared while typing
  const [inputVal, setInputVal] = useState("");

    useEffect(() => {
      setInputVal(String(value));
    }, []);

  // Keep local string in sync when slider moves
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = +e.target.value;
    setInputVal(String(n));
    onChange(n);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputVal(raw); // allow empty / partial input while typing
    if (raw === "" || raw === "-") return; // don't commit yet
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
  };

  const handleBlur = () => {
    // On blur: if empty or invalid, reset to current value (treat blank as 0)
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || inputVal === "" || inputVal === "-") {
      setInputVal("0");
      onChange(0);
    } else {
      const clamped = Math.min(max, Math.max(min, n));
      setInputVal(String(clamped));
      onChange(clamped);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-xs text-mc-stone-500">
        <span className="uppercase tracking-widest">{label}</span>
        <input
          type="text"
          value={inputVal}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="0"
          className={`w-16 rounded border px-2 py-0.5 text-right text-xs font-bold font-mono
            bg-white border-mc-stone-300 text-mc-stone-900
            focus:outline-none focus:border-mc-grass-500
            ${value !== 0 ? "border-mc-grass-400" : ""}
          `}
        />
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={handleSlider}
        className="w-full accent-mc-grass-500"
      />
      <div className="flex justify-between text-[10px] font-mono" style={{ color: "#8a8883" }}>
        <span>{min}</span>
        <span>0</span>
        <span>+{max}</span>
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
  gridWidth:     64,
  gridHeight:    64,
  palette:       toPaletteBlocks(FULL_PALETTE),
  palettePreset: FULL_PALETTE.name,
  mapArtMode:    false,
  dithering:     false,
  brightness:    0,
  contrast:      0,
  depth:         1,
  depthMode:     "flat",
};

// ── Component ─────────────────────────────────────────────────────────────────

function ConversionSettings({
  settings,
  onSettingsChange,
  onReconvert,
  hasImage,
  hasBlockData,
  isConverting,
}: ConversionSettingsProps) {

  const [depthInput, setDepthInput] = useState("");

    useEffect(() => {
      setDepthInput(String(settings.depth));
    }, []);

  const patch = useCallback(
    (p: Partial<ConversionSettingsData>) => onSettingsChange({ ...settings, ...p }),
    [settings, onSettingsChange]
  );

  const handleDepthText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDepthInput(raw);
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (!isNaN(n)) patch({ depth: Math.min(10, Math.max(1, n)) });
  };

  const handleDepthBlur = () => {
    const n = parseInt(depthInput, 10);
    if (isNaN(n) || depthInput === "") {
      setDepthInput("1");
      patch({ depth: 1 });
    } else {
      const clamped = Math.min(10, Math.max(1, n));
      setDepthInput(String(clamped));
      patch({ depth: clamped });
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full font-mono text-sm rounded-md border-2 border-mc-stone-300 bg-mc-stone-100 p-4">

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
        <div className="flex justify-between items-center text-xs text-mc-stone-500">
          <span className="uppercase tracking-widest">Extrusion Depth</span>
          <input
            type="text"
            value={depthInput}
            onChange={handleDepthText}
            onBlur={handleDepthBlur}
            placeholder="1"
            className={`w-16 rounded border px-2 py-0.5 text-right text-xs font-bold font-mono
              bg-white border-mc-stone-300 text-mc-stone-900
              focus:outline-none focus:border-mc-grass-500
              ${settings.depth > 1 ? "border-mc-grass-400" : ""}
            `}
          />
        </div>
        <input
          type="range" min={1} max={10} value={settings.depth}
          onChange={e => {
            const n = +e.target.value;
            setDepthInput(String(n));
            patch({ depth: n });
          }}
          className="w-full accent-mc-grass-500"
        />
        <div className="flex justify-between text-[10px] font-mono" style={{ color: "#8a8883" }}>
          <span>1 (flat)</span>
          <span>10</span>
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
export default memo(ConversionSettings);
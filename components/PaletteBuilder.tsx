"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConversionPaletteBlock } from "@/components/ConversionSettings";

interface BlockColor {
  id: string;
  name: string;
  rgb: [number, number, number];
  category: string;
}

interface SavedCustomPalette {
  id: string;
  name: string;
  blockIds: string[];
  updatedAt: number;
}

interface PaletteBuilderProps {
  selectedBlocks: ConversionPaletteBlock[];
  onChange: (nextPalette: ConversionPaletteBlock[], sourceLabel?: string) => void;
}

const STORAGE_KEY = "minecraft.customPalettes.v1";
const HUE_BUCKETS = 12;

const normalizeBlockId = (id: string) => id.replace(/^minecraft:/, "");

function rgbToHue([r, g, b]: [number, number, number]): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;

  const degrees = hue * 60;
  return degrees < 0 ? degrees + 360 : degrees;
}

function toConversionPalette(blocks: BlockColor[], selected: Set<string>): ConversionPaletteBlock[] {
  return blocks
    .filter((block) => selected.has(normalizeBlockId(block.id)))
    .map((block) => ({
      id: block.id,
      name: block.name,
      rgb: block.rgb,
    }));
}

export default function PaletteBuilder({ selectedBlocks, onChange }: PaletteBuilderProps) {
  const [allBlocks, setAllBlocks] = useState<BlockColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paletteName, setPaletteName] = useState("");
  const [savedPalettes, setSavedPalettes] = useState<SavedCustomPalette[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");

  useEffect(() => {
    let active = true;

    const loadBlocks = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/block-colors");
        if (!res.ok) throw new Error(`Failed to fetch blocks (${res.status})`);
        const data = (await res.json()) as BlockColor[];
        if (active) setAllBlocks(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load block palette data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBlocks();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedCustomPalette[];
      setSavedPalettes(parsed);
      if (parsed[0]) setSelectedSavedId(parsed[0].id);
    } catch {
      setSavedPalettes([]);
    }
  }, []);

  useEffect(() => {
    const normalized = new Set(selectedBlocks.map((block) => normalizeBlockId(block.id)));
    setSelectedIds(normalized);
  }, [selectedBlocks]);

  const categories = useMemo(() => {
    return Array.from(new Set(allBlocks.map((block) => block.category))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [allBlocks]);

  const visibleBlocks = useMemo(() => {
    if (categoryFilter === "all") return allBlocks;
    return allBlocks.filter((block) => block.category === categoryFilter);
  }, [allBlocks, categoryFilter]);

  const selectedCount = selectedIds.size;

  const colorCoverage = useMemo(() => {
    if (!allBlocks.length || !selectedIds.size) {
      return { percent: 0, buckets: new Set<number>() };
    }

    const buckets = new Set<number>();
    for (const block of allBlocks) {
      if (!selectedIds.has(normalizeBlockId(block.id))) continue;
      const hue = rgbToHue(block.rgb);
      const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((hue / 360) * HUE_BUCKETS));
      buckets.add(bucket);
    }

    return {
      percent: Math.round((buckets.size / HUE_BUCKETS) * 100),
      buckets,
    };
  }, [allBlocks, selectedIds]);

  const emitPalette = (next: Set<string>, sourceLabel?: string) => {
    const converted = toConversionPalette(allBlocks, next);
    onChange(converted, sourceLabel);
  };

  const toggleBlock = (block: BlockColor) => {
    const key = normalizeBlockId(block.id);
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    setSelectedIds(next);
    emitPalette(next);
  };

  const selectAllCategory = () => {
    if (categoryFilter === "all") {
      const next = new Set(allBlocks.map((block) => normalizeBlockId(block.id)));
      setSelectedIds(next);
      emitPalette(next);
      return;
    }

    const next = new Set(selectedIds);
    allBlocks
      .filter((block) => block.category === categoryFilter)
      .forEach((block) => next.add(normalizeBlockId(block.id)));

    setSelectedIds(next);
    emitPalette(next);
  };

  const clearCurrentCategory = () => {
    const next = new Set(selectedIds);
    const scoped =
      categoryFilter === "all"
        ? allBlocks
        : allBlocks.filter((block) => block.category === categoryFilter);

    scoped.forEach((block) => next.delete(normalizeBlockId(block.id)));
    setSelectedIds(next);
    emitPalette(next);
  };

  const persistSavedPalettes = (next: SavedCustomPalette[]) => {
    setSavedPalettes(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const saveCurrentPalette = () => {
    const trimmedName = paletteName.trim();
    if (!trimmedName || selectedIds.size === 0) return;

    const now = Date.now();
    const existing = savedPalettes.find((item) => item.name.toLowerCase() === trimmedName.toLowerCase());

    if (existing) {
      const updated: SavedCustomPalette = {
        ...existing,
        name: trimmedName,
        blockIds: Array.from(selectedIds),
        updatedAt: now,
      };
      const next = savedPalettes
        .map((item) => (item.id === existing.id ? updated : item))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      persistSavedPalettes(next);
      setSelectedSavedId(updated.id);
      return;
    }

    const created: SavedCustomPalette = {
      id: `custom-${now}`,
      name: trimmedName,
      blockIds: Array.from(selectedIds),
      updatedAt: now,
    };

    const next = [created, ...savedPalettes].sort((a, b) => b.updatedAt - a.updatedAt);
    persistSavedPalettes(next);
    setSelectedSavedId(created.id);
  };

  const loadSavedPalette = () => {
    const picked = savedPalettes.find((item) => item.id === selectedSavedId);
    if (!picked) return;

    const next = new Set(picked.blockIds);
    setSelectedIds(next);
    emitPalette(next, picked.name);
  };

  const deleteSavedPalette = () => {
    if (!selectedSavedId) return;

    const next = savedPalettes.filter((item) => item.id !== selectedSavedId);
    persistSavedPalettes(next);
    setSelectedSavedId(next[0]?.id ?? "");
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-mc-stone-300 bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-mc-stone-600 uppercase tracking-widest">Custom Palette Builder</h3>
        <span className="text-[11px] text-mc-stone-500">Selected: {selectedCount}</span>
      </div>

      <div className="flex flex-col gap-2 rounded border border-mc-stone-200 bg-mc-stone-50 p-2">
        <div className="flex items-center justify-between text-[11px] text-mc-stone-600">
          <span className="uppercase tracking-widest">Color Coverage</span>
          <span className="font-semibold text-mc-stone-700">{colorCoverage.percent}%</span>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: HUE_BUCKETS }, (_, idx) => {
            const filled = colorCoverage.buckets.has(idx);
            return (
              <div
                key={idx}
                className={`h-2 rounded ${filled ? "bg-mc-grass-500" : "bg-mc-stone-200"}`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={selectAllCategory}
          className="rounded border border-mc-stone-300 px-2 py-1 text-xs text-mc-stone-700 hover:bg-mc-stone-100"
        >
          Select all in category
        </button>

        <button
          type="button"
          onClick={clearCurrentCategory}
          className="rounded border border-mc-stone-300 px-2 py-1 text-xs text-mc-stone-700 hover:bg-mc-stone-100"
        >
          Clear category
        </button>
      </div>

      <div className="max-h-56 overflow-auto rounded border border-mc-stone-200 bg-mc-stone-50 p-2">
        {loading && <p className="text-xs text-mc-stone-500">Loading blocks...</p>}
        {!!error && <p className="text-xs text-red-600">{error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {visibleBlocks.map((block) => {
              const key = normalizeBlockId(block.id);
              const selected = selectedIds.has(key);

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => toggleBlock(block)}
                  title={`${block.name} (${block.category})`}
                  className={`group flex flex-col items-center gap-1 rounded border p-1 transition ${
                    selected
                      ? "border-mc-grass-500 ring-1 ring-mc-grass-500 bg-white"
                      : "border-transparent hover:border-mc-stone-300"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded border border-mc-stone-200"
                    style={{ backgroundColor: `rgb(${block.rgb.join(",")})` }}
                  />
                  <span className="line-clamp-2 text-center text-[10px] leading-tight text-mc-stone-600">
                    {block.name.replace(/^minecraft:/, "")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={paletteName}
          onChange={(e) => setPaletteName(e.target.value)}
          placeholder="Palette name"
          className="min-w-40 flex-1 rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
        />
        <button
          type="button"
          onClick={saveCurrentPalette}
          disabled={!paletteName.trim() || selectedCount === 0}
          className="rounded bg-mc-grass-500 px-3 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save custom palette
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedSavedId}
          onChange={(e) => setSelectedSavedId(e.target.value)}
          className="min-w-44 flex-1 rounded border border-mc-stone-300 bg-white px-2 py-1 text-xs focus:outline-none focus:border-mc-grass-500"
        >
          {savedPalettes.length === 0 && <option value="">No saved palettes</option>}
          {savedPalettes.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadSavedPalette}
          disabled={!selectedSavedId}
          className="rounded border border-mc-stone-300 px-3 py-1 text-xs text-mc-stone-700 hover:bg-mc-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Load
        </button>

        <button
          type="button"
          onClick={deleteSavedPalette}
          disabled={!selectedSavedId}
          className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

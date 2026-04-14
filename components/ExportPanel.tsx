"use client";

import { useMemo, useState } from "react";

import type { BlockGridData } from "@/components/BlockPreview";

type ExportFormat = "schem" | "nbt";
type Orientation = "wall" | "floor";
type DownloadAction = "schematic" | "preview" | "block-list";

interface ExportPanelProps {
  blockData: BlockGridData;
  initialDepth?: number;
  mapArtMode?: boolean;
}

function parseFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateExportSize(
  width: number,
  height: number,
  depth: number,
  format: ExportFormat,
  uniqueBlocks: number
) {
  const totalCells = width * height;
  const volume = totalCells * Math.max(depth, 1);
  const headerBytes = 640 + uniqueBlocks * 40;
  const payloadBytes = format === "schem" ? volume * 1.8 : volume * 3.1;
  return Math.max(512, Math.round(headerBytes + payloadBytes));
}

export default function ExportPanel({ blockData, initialDepth = 1, mapArtMode = false }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [format, setFormat] = useState<ExportFormat>("schem");
  const [orientation, setOrientation] = useState<Orientation>("floor");
  const [depth, setDepth] = useState(Math.min(10, Math.max(1, initialDepth)));
  const [activeDownload, setActiveDownload] = useState<DownloadAction | null>(null);
  const [error, setError] = useState<string>("");

  const width = blockData.grid[0]?.length ?? blockData.dimensions?.width ?? 0;
  const height = blockData.grid.length || blockData.dimensions?.height || 0;
  const uniqueBlocks = Object.keys(blockData.paletteSummary ?? {}).length;
  const estimatedSize = useMemo(
    () => estimateExportSize(width, height, mapArtMode ? 1 : depth, format, uniqueBlocks),
    [width, height, depth, format, uniqueBlocks, mapArtMode]
  );

  async function downloadFile(action: DownloadAction) {
    setActiveDownload(action);
    setError("");

    try {
      const request =
        action === "schematic"
          ? {
              endpoint: "/api/export/schematic",
              payload: { grid: blockData.grid, format, orientation, depth, map_art_mode: mapArtMode },
              fallbackName: `minecraft-build.${format}`,
            }
          : action === "preview"
            ? {
                endpoint: "/api/export/preview-image",
                payload: { grid: blockData.grid, scale: 24 },
                fallbackName: "minecraft-preview.png",
              }
            : {
                endpoint: "/api/export/block-list",
                payload: { grid: blockData.grid, format: "csv" },
                fallbackName: "minecraft-blocks.csv",
              };

      const response = await fetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const filename = parseFilename(response.headers.get("content-disposition"), request.fallbackName);
      triggerDownload(blob, filename);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Export failed.");
    } finally {
      setActiveDownload(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-mc-stone-300 bg-linear-to-br from-mc-stone-50 via-mc-stone-100 to-mc-dirt-100 shadow-[0_18px_45px_rgba(50,50,48,0.08)]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-mc-stone-500">Download Panel</p>
          <h2 className="mt-1 font-mono text-lg font-bold uppercase tracking-wide text-mc-stone-900">
            Export Build Assets
          </h2>
        </div>
        <div className="text-right font-mono text-xs text-mc-stone-600">
          <p>{width}×{height} blocks</p>
          <p>{isOpen ? "Hide options" : "Show options"}</p>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-mc-stone-300 px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 rounded-xl border border-mc-stone-300 bg-white/80 p-3 font-mono text-xs uppercase tracking-widest text-mc-stone-600">
                Structure Format
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ExportFormat)}
                  className="rounded-md border border-mc-stone-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-mc-stone-900 focus:outline-none focus:border-mc-grass-500"
                >
                  <option value="schem">.schem</option>
                  <option value="nbt">.nbt</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 rounded-xl border border-mc-stone-300 bg-white/80 p-3 font-mono text-xs uppercase tracking-widest text-mc-stone-600">
                Placement
                <select
                  value={orientation}
                  onChange={(event) => setOrientation(event.target.value as Orientation)}
                  className="rounded-md border border-mc-stone-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-mc-stone-900 focus:outline-none focus:border-mc-grass-500"
                >
                  <option value="floor">Floor</option>
                  <option value="wall">Wall</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 rounded-xl border border-mc-stone-300 bg-white/80 p-3 font-mono text-xs uppercase tracking-widest text-mc-stone-600">
                Depth
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={depth}
                    onChange={(event) => setDepth(Number(event.target.value))}
                    className="w-full accent-mc-grass-500"
                  />
                  <span className="min-w-10 text-right text-sm font-bold text-mc-stone-900">{depth}</span>
                </div>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-mc-stone-300 bg-mc-stone-900 px-4 py-3 font-mono text-mc-stone-50">
                <p className="text-[11px] uppercase tracking-[0.24em] text-mc-stone-300">Estimated Export Size</p>
                <p className="mt-2 text-2xl font-bold">{formatBytes(estimatedSize)}</p>
                <p className="mt-1 text-xs text-mc-stone-300">Approximate size for the selected structure file.</p>
              </div>
              <div className="rounded-xl border border-mc-stone-300 bg-white/80 px-4 py-3 font-mono text-xs text-mc-stone-700">
                <p className="uppercase tracking-[0.24em] text-mc-stone-500">Quick Stats</p>
                <p className="mt-2">Blocks: {(blockData.blockCount ?? width * height).toLocaleString()}</p>
                <p className="mt-1">Unique materials: {uniqueBlocks || "Unknown"}</p>
                <p className="mt-1">Best for: {orientation === "wall" ? "pixel art walls" : "ground builds and map art"}</p>
                <p className="mt-1">Map art mode: {mapArtMode ? "enabled" : "disabled"}</p>
              </div>
            </div>
          </div>

          {mapArtMode && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs text-amber-800">
              Map art mode exports a staircase-height schematic so the image shades correctly when viewed on an in-game map.
            </p>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => downloadFile("schematic")}
              disabled={activeDownload !== null}
              className="rounded-xl border border-mc-grass-500 bg-mc-grass-500 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeDownload === "schematic" ? "Preparing..." : `Download ${format}`}
            </button>
            <button
              type="button"
              onClick={() => downloadFile("preview")}
              disabled={activeDownload !== null}
              className="rounded-xl border border-mc-stone-300 bg-white px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-mc-stone-900 transition hover:bg-mc-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeDownload === "preview" ? "Rendering..." : "Download Preview PNG"}
            </button>
            <button
              type="button"
              onClick={() => downloadFile("block-list")}
              disabled={activeDownload !== null}
              className="rounded-xl border border-mc-stone-300 bg-white px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-mc-stone-900 transition hover:bg-mc-dirt-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeDownload === "block-list" ? "Compiling..." : "Download Block List CSV"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
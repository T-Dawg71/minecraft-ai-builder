"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { BlockGrid } from "@/components/BlockPreview";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComparisonViewProps {
  imageBase64: string;
  grid: BlockGrid;
}

interface PanOffset { x: number; y: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_SIZE  = 4;   // px per block at 1x (128×128 fits in ~512px)
const MIN_ZOOM   = 0.5;
const MAX_ZOOM   = 8;
const ZOOM_STEP  = 0.25;

// ── Stats helpers (DEV-171) ───────────────────────────────────────────────────

function computeStats(grid: BlockGrid) {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      counts[cell.name] = (counts[cell.name] ?? 0) + 1;
      total++;
    }
  }
  const uniqueTypes  = Object.keys(counts).length;
  const mostUsed     = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  // Color accuracy: ratio of dominant block to total (higher = more uniform/accurate mapping)
  const accuracy     = total > 0 ? Math.round((mostUsed[1] / total) * 100) : 0;
  return { total, uniqueTypes, mostUsed: mostUsed[0], accuracy };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComparisonView({ imageBase64, grid }: ComparisonViewProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Shared zoom/pan state (DEV-169)
  const [zoom,   setZoom]   = useState(1);
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const isDragging  = useRef(false);
  const dragStart   = useRef({ x: 0, y: 0 });
  const lastOffset  = useRef<PanOffset>({ x: 0, y: 0 });

  // Overlay toggle (DEV-170)
  const [overlayMode, setOverlayMode] = useState(false);

  // Stats (DEV-171)
  const stats = computeStats(grid);

  // ── Fit zoom ──────────────────────────────────────────────────────────────
  const fitZoom = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // ── Draw block grid to canvas ─────────────────────────────────────────────
  const drawGrid = useCallback((canvas: HTMLCanvasElement, opacity = 1) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cellPx = CELL_SIZE * zoom;
    canvas.width  = cols * cellPx;
    canvas.height = rows * cellPx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = opacity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = grid[r][c].color;
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      }
    }
    ctx.globalAlpha = 1;
  }, [grid, zoom, rows, cols]);

  // Draw main block canvas
  useEffect(() => {
    if (canvasRef.current) drawGrid(canvasRef.current);
  }, [drawGrid]);

  // Draw overlay canvas at 50% opacity (DEV-170)
  useEffect(() => {
    if (overlayRef.current) drawGrid(overlayRef.current, 0.5);
  }, [drawGrid]);

  // ── Shared zoom controls ──────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => Math.min(+(z + ZOOM_STEP).toFixed(2), MAX_ZOOM));
  const zoomOut = () => setZoom(z => Math.max(+(z - ZOOM_STEP).toFixed(2), MIN_ZOOM));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  };

  // ── Shared pan controls ───────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, y: e.clientY };
    lastOffset.current = offset;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: lastOffset.current.x + e.clientX - dragStart.current.x,
      y: lastOffset.current.y + e.clientY - dragStart.current.y,
    });
  };
  const onMouseUp = () => { isDragging.current = false; };

  const cellPx   = CELL_SIZE * zoom;
  const imgStyle = {
    transform:       `translate(${offset.x}px, ${offset.y}px)`,
    transformOrigin: "top left",
    position:        "absolute" as const,
    width:           cols * cellPx,
    height:          rows * cellPx,
  };

  const panHandlers = {
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: () => { isDragging.current = false; },
  };

  const viewportStyle = {
    height:   400,
    cursor:   isDragging.current ? "grabbing" : "grab",
  };

  return (
    <div className="flex flex-col gap-3 w-full font-mono">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between text-xs text-mc-stone-700">
        <span className="text-mc-stone-500 uppercase tracking-widest">
          {cols}×{rows} blocks
        </span>
        <div className="flex items-center gap-1">
          {/* Overlay toggle (DEV-170) */}
          <button
            onClick={() => setOverlayMode(o => !o)}
            className={`px-2 py-1 rounded border text-xs transition-colors ${
              overlayMode
                ? "bg-mc-grass-500 border-mc-grass-500 text-white"
                : "border-mc-stone-300 hover:bg-mc-stone-100"
            }`}
          >
            Overlay
          </button>
          <div className="ml-2 flex items-center gap-1">
            <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
              className="px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 disabled:opacity-40 transition-colors"
            >−</button>
            <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
              className="px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 disabled:opacity-40 transition-colors"
            >+</button>
            <button onClick={fitZoom}
              className="ml-1 px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 transition-colors"
            >Fit</button>
          </div>
        </div>
      </div>

      {overlayMode ? (
        /* ── Overlay mode (DEV-170): block grid at 50% over original ── */
        <div
          className="relative overflow-hidden rounded-md border-2 border-mc-stone-300 bg-mc-dark"
          style={viewportStyle}
          {...panHandlers}
        >
          {/* Original image */}
          <div style={imgStyle}>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="Original"
              style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
              draggable={false}
            />
          </div>
          {/* Block grid overlay at 50% opacity */}
          <div style={imgStyle}>
            <canvas ref={overlayRef} style={{ display: "block" }} />
          </div>
        </div>
      ) : (
        /* ── Side-by-side mode (DEV-168): image left, blocks right ── */
        <div className="grid grid-cols-2 gap-2">
          {/* Left: original image */}
          <div>
            <p className="text-xs text-mc-stone-500 uppercase tracking-widest mb-1">Original</p>
            <div
              className="relative overflow-hidden rounded-md border-2 border-mc-stone-300 bg-mc-dark"
              style={viewportStyle}
              {...panHandlers}
            >
              <div style={imgStyle}>
                <img
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Original"
                  style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
                  draggable={false}
                />
              </div>
            </div>
          </div>

          {/* Right: block preview */}
          <div>
            <p className="text-xs text-mc-stone-500 uppercase tracking-widest mb-1">Blocks</p>
            <div
              className="relative overflow-hidden rounded-md border-2 border-mc-stone-300 bg-mc-dark"
              style={viewportStyle}
              {...panHandlers}
            >
              <div style={imgStyle}>
                <canvas ref={canvasRef} style={{ display: "block" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats panel (DEV-171) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { label: "Total Blocks",   value: stats.total.toLocaleString() },
          { label: "Unique Types",   value: stats.uniqueTypes },
          { label: "Most Used",      value: stats.mostUsed.replace(/_/g, " ") },
          { label: "Color Accuracy", value: `${stats.accuracy}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border border-mc-stone-300 bg-mc-stone-100 px-3 py-2">
            <p className="text-mc-stone-500 uppercase tracking-widest text-[10px]">{label}</p>
            <p className="text-mc-stone-900 font-bold mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
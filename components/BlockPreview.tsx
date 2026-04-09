"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlockCell {
  name: string;   // e.g. "grass_block", "stone"
  color: string;  // hex color for rendering, e.g. "#5D8A3C"
}

export type BlockGrid = BlockCell[][];  // [row][col]

interface BlockPreviewProps {
  grid: BlockGrid;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE   = 8;   // px per block at 1x zoom
const MIN_ZOOM    = 0.5;
const MAX_ZOOM    = 8;
const ZOOM_STEP   = 0.25;

// ── Component ────────────────────────────────────────────────────────────────

export default function BlockPreview({ grid }: BlockPreviewProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const useCanvas = rows > 64 || cols > 64;   // DEV-160

  // Zoom & pan state
  const [zoom, setZoom]     = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0 });
  const lastOffset = useRef({ x: 0, y: 0 });

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  // ── Fit zoom to container ──────────────────────────────────────────────────
  const fitZoom = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const fitZ = Math.min(width / (cols * CELL_SIZE), height / (rows * CELL_SIZE), MAX_ZOOM);
    setZoom(Math.max(fitZ, MIN_ZOOM));
    setOffset({ x: 0, y: 0 });
  }, [rows, cols]);

  // Fit on mount
  useEffect(() => { fitZoom(); }, [fitZoom]);

  // ── Canvas rendering (DEV-160, DEV-165) ───────────────────────────────────
  useEffect(() => {
    if (!useCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellPx = CELL_SIZE * zoom;
    canvas.width  = cols * cellPx;
    canvas.height = rows * cellPx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = grid[r][c].color;
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
        // 1-px darker border for grid lines
        if (cellPx >= 4) {
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth   = 0.5;
          ctx.strokeRect(c * cellPx, r * cellPx, cellPx, cellPx);
        }
      }
    }
  }, [grid, zoom, useCanvas, rows, cols]);

  // ── Zoom handlers (DEV-162) ────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => Math.min(+(z + ZOOM_STEP).toFixed(2), MAX_ZOOM));
  const zoomOut = () => setZoom(z => Math.max(+(z - ZOOM_STEP).toFixed(2), MIN_ZOOM));

  // Scroll-wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  };

  // ── Pan handlers (DEV-163) ─────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current  = true;
    dragStart.current   = { x: e.clientX, y: e.clientY };
    lastOffset.current  = offset;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: lastOffset.current.x + e.clientX - dragStart.current.x,
      y: lastOffset.current.y + e.clientY - dragStart.current.y,
    });
  };
  const onMouseUp = () => { isDragging.current = false; };

  // ── Tooltip (DEV-161) ──────────────────────────────────────────────────────
  const onMouseMoveTooltip = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect    = e.currentTarget.getBoundingClientRect();
    const cellPx  = CELL_SIZE * zoom;
    const col = Math.floor((e.clientX - rect.left  - offset.x) / cellPx);
    const row = Math.floor((e.clientY - rect.top   - offset.y) / cellPx);
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      setTooltip({
        name: grid[row][col].name,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setTooltip(null);
    }
  };

  const cellPx = CELL_SIZE * zoom;

  return (
    <div className="flex flex-col gap-2 w-full font-mono">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between text-xs text-mc-stone-700">
        {/* DEV-164: dimensions label */}
        <span className="text-mc-stone-500 uppercase tracking-widest">
          {cols}×{rows} blocks
        </span>

        {/* DEV-162: zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 disabled:opacity-40 transition-colors"
            aria-label="Zoom out"
          >−</button>
          <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 disabled:opacity-40 transition-colors"
            aria-label="Zoom in"
          >+</button>
          <button
            onClick={fitZoom}
            className="ml-1 px-2 py-1 rounded border border-mc-stone-300 hover:bg-mc-stone-100 transition-colors"
            aria-label="Fit to view"
          >Fit</button>
        </div>
      </div>

      {/* ── Viewport ── */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-md border-2 border-mc-stone-300 bg-mc-dark"
        style={{ height: 400, cursor: isDragging.current ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={(e) => { onMouseMove(e); onMouseMoveTooltip(e); }}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { isDragging.current = false; setTooltip(null); }}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: "top left",
            width: cols * cellPx,
            height: rows * cellPx,
            position: "absolute",
          }}
        >
          {useCanvas ? (
            /* Canvas path — large grids (>64×64) — DEV-160, DEV-165 */
            <canvas ref={canvasRef} style={{ display: "block" }} />
          ) : (
            /* CSS grid path — small grids ≤64×64 — DEV-160 */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                gridTemplateRows:    `repeat(${rows}, ${cellPx}px)`,
              }}
            >
              {grid.flat().map((cell, i) => (
                <div
                  key={i}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    backgroundColor: cell.color,
                    boxShadow: cellPx >= 4 ? "inset 0 0 0 0.5px rgba(0,0,0,0.15)" : undefined,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* DEV-161: hover tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-mc-stone-900 px-2 py-1 text-xs text-white shadow-lg"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            {tooltip.name.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </div>
  );
}
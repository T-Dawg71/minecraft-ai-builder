"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  materializeBlockGrid,
  type BlockGrid,
  type BlockGridData,
} from "@/components/BlockPreview";

interface ComparisonViewProps {
  imageBase64: string | null;
  blockData: BlockGridData | null;
  isConverting?: boolean;
}

interface PanOffset { x: number; y: number; }

const CELL_SIZE  = 4;
const MIN_ZOOM   = 0.5;
const MAX_ZOOM   = 8;
const ZOOM_STEP  = 0.25;

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
  return { total, uniqueTypes, mostUsed: mostUsed?.[0] ?? "none", };
}

export default function ComparisonView({ imageBase64, blockData, isConverting = false }: ComparisonViewProps) {
  // ALL hooks must be called before any conditional return
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const isDragging   = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const lastOffset   = useRef<PanOffset>({ x: 0, y: 0 });

  const [zoom, setZoom]             = useState(1);
  const [offset, setOffset]         = useState<PanOffset>({ x: 0, y: 0 });
  const [overlayMode, setOverlayMode] = useState(false);
  const [dragging, setDragging] = useState(false);

  const hasData = !!(imageBase64 && blockData?.grid?.length);

  const grid = useMemo(() => {
    if (!hasData || !blockData) return null;
    return materializeBlockGrid(blockData);
  }, [hasData, blockData]);

  const rows = grid?.length ?? 0;
  const cols = grid?.[0]?.length ?? 0;
  const stats = useMemo(() => grid ? computeStats(grid) : null, [grid]);

  const fitZoom = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const drawGrid = useCallback((canvas: HTMLCanvasElement, opacity = 1) => {
    if (!grid) return;
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

  useEffect(() => {
    if (canvasRef.current && grid) drawGrid(canvasRef.current);
  }, [drawGrid, grid]);

  useEffect(() => {
    if (overlayRef.current && grid) drawGrid(overlayRef.current, 0.5);
  }, [drawGrid, grid]);

  // Now safe to do conditional returns AFTER all hooks
  if (!hasData) {
    return (
      <div className="rounded-lg border border-stone-700 bg-stone-800 p-8 min-h-[400px] flex items-center justify-center">
        <p className="text-center text-sm font-mono text-stone-500">
          {isConverting
            ? "Converting image into Minecraft blocks..."
            : "Enter a description and click Generate to see your creation"}
        </p>
      </div>
    );
  }

  const zoomIn  = () => setZoom(z => Math.min(+(z + ZOOM_STEP).toFixed(2), MAX_ZOOM));
  const zoomOut = () => setZoom(z => Math.max(+(z - ZOOM_STEP).toFixed(2), MIN_ZOOM));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    setDragging(true);
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
  const onMouseUp = () => {
    isDragging.current = false;
    setDragging(false);
  };

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
    onMouseLeave: () => { isDragging.current = false; setDragging(false); },
  };

  const viewportStyle = {
    height:   400,
    cursor:   dragging ? "grabbing" : "grab",
  };

  return (
    <div className="flex flex-col gap-3 w-full font-mono">
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span className="uppercase tracking-widest">
          {cols}×{rows} blocks
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOverlayMode(o => !o)}
            className={`px-2 py-1 rounded border text-xs transition-colors ${
              overlayMode
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-stone-600 text-stone-300 hover:bg-stone-700"
            }`}
          >
            Overlay
          </button>
          <div className="ml-2 flex items-center gap-1">
            <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
              className="px-2 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >−</button>
            <span className="w-12 text-center text-stone-300">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
              className="px-2 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >+</button>
            <button onClick={fitZoom}
              className="ml-1 px-2 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-700 transition-colors"
            >Fit</button>
          </div>
        </div>
      </div>

      {overlayMode ? (
        <div
          className="relative overflow-hidden rounded-md border-2 border-stone-700 bg-stone-900"
          style={viewportStyle}
          {...panHandlers}
        >
          <div style={imgStyle}>
            <Image
              src={`data:image/png;base64,${imageBase64}`}
              alt="Original"
              fill
              unoptimized
              draggable={false}
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{ objectFit: "fill", imageRendering: "pixelated" }}
            />
          </div>
          <div style={imgStyle}>
            <canvas ref={overlayRef} style={{ display: "block" }} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Original</p>
            <div
              className="relative overflow-hidden rounded-md border-2 border-stone-700 bg-stone-900"
              style={viewportStyle}
              {...panHandlers}
            >
              <div style={imgStyle}>
                <Image
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Original"
                  fill
                  unoptimized
                  draggable={false}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  style={{ objectFit: "fill", imageRendering: "pixelated" }}
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Blocks</p>
            <div
              className="relative overflow-hidden rounded-md border-2 border-stone-700 bg-stone-900"
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

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { label: "Total Blocks",   value: (blockData?.blockCount ?? stats.total).toLocaleString() },
            { label: "Unique Types",   value: Object.keys(blockData?.paletteSummary ?? {}).length || stats.uniqueTypes },
            { label: "Most Used",      value: stats.mostUsed.replace(/minecraft:/g, "").replace(/_/g, " ") },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border border-stone-700 bg-stone-800 px-3 py-2">
              <p className="text-stone-500 uppercase tracking-widest text-[10px]">{label}</p>
              <p className="text-emerald-400 font-bold mt-0.5 truncate">{String(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export interface BlockGridData {
  grid: string[][];
  colors: { [blockId: string]: number[] };
  dimensions: { width: number; height: number };
  blockCount: number;
  paletteSummary: { [blockId: string]: number };
}

interface BlockPreviewProps {
  data: BlockGridData | null;
  isLoading?: boolean;
}

export default function BlockPreview({ data, isLoading = false }: BlockPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  const CELL_SIZE = 8;

  // Render the grid to canvas
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = data.dimensions;
    canvas.width = width * CELL_SIZE;
    canvas.height = height * CELL_SIZE;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const blockId = data.grid[y]?.[x];
        const color = blockId ? data.colors[blockId] : [128, 128, 128];
        if (color) {
          ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }, [data]);

  // Fit to container on load
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const container = containerRef.current;
    const canvasW = data.dimensions.width * CELL_SIZE;
    const canvasH = data.dimensions.height * CELL_SIZE;
    const scaleX = container.clientWidth / canvasW;
    const scaleY = container.clientHeight / canvasH;
    const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9;
    setZoom(fitZoom);
    setOffset({ x: 0, y: 0 });
  }, [data]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.1, Math.min(10, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    // Tooltip
    if (data && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (CELL_SIZE * zoom));
      const y = Math.floor((e.clientY - rect.top) / (CELL_SIZE * zoom));

      if (x >= 0 && x < data.dimensions.width && y >= 0 && y < data.dimensions.height) {
        const blockId = data.grid[y]?.[x];
        if (blockId) {
          const name = blockId.replace('minecraft:', '').replace(/_/g, ' ');
          setTooltip({ name, x: e.clientX, y: e.clientY });
        }
      } else {
        setTooltip(null);
      }
    }
  }, [isDragging, dragStart, data, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFit = () => {
    if (!data || !containerRef.current) return;
    const container = containerRef.current;
    const canvasW = data.dimensions.width * CELL_SIZE;
    const canvasH = data.dimensions.height * CELL_SIZE;
    const scaleX = container.clientWidth / canvasW;
    const scaleY = container.clientHeight / canvasH;
    setZoom(Math.min(scaleX, scaleY, 1) * 0.9);
    setOffset({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span className="text-stone-400 text-sm font-mono">Converting to blocks...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 min-h-[400px] flex items-center justify-center">
        <p className="text-stone-500 text-sm font-mono">Block preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono text-stone-400 uppercase tracking-widest">
          Block Preview — {data.dimensions.width}×{data.dimensions.height}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(10, z * 1.5))}
            className="px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-xs text-stone-300"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.5))}
            className="px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-xs text-stone-300"
          >
            −
          </button>
          <button
            onClick={handleFit}
            className="px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-xs text-stone-300"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden min-h-[350px] bg-stone-900 rounded cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setTooltip(null); }}
      >
        <canvas
          ref={canvasRef}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            imageRendering: 'pixelated',
          }}
        />
        {tooltip && (
          <div
            className="fixed z-50 px-2 py-1 bg-stone-900 border border-stone-600 rounded text-xs text-stone-200 font-mono pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
          >
            {tooltip.name}
          </div>
        )}
      </div>

      <div className="text-xs text-stone-500 font-mono">
        {data.blockCount} blocks • {Object.keys(data.paletteSummary).length} unique types
      </div>
    </div>
  );
}
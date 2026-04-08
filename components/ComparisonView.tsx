'use client';

import { useState } from 'react';
import BlockPreview, { BlockGridData } from './BlockPreview';

interface ComparisonViewProps {
  imageBase64: string | null;
  blockData: BlockGridData | null;
  isConverting?: boolean;
}

export default function ComparisonView({
  imageBase64,
  blockData,
  isConverting = false,
}: ComparisonViewProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  if (!imageBase64 && !blockData) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono text-stone-400 uppercase tracking-widest">
          Comparison
        </h2>
        {imageBase64 && blockData && (
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              showOverlay
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            {showOverlay ? 'Side by Side' : 'Overlay'}
          </button>
        )}
      </div>

      {showOverlay ? (
        <div className="relative bg-stone-900 rounded-lg overflow-hidden min-h-[350px]">
          {imageBase64 && (
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="Original"
              className="w-full object-contain"
            />
          )}
          {blockData && (
            <div className="absolute inset-0 opacity-50">
              <BlockPreview data={blockData} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Image */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-stone-500">Original</span>
            {imageBase64 ? (
              <div className="border-2 border-stone-700 rounded-md overflow-hidden bg-stone-900">
                <img
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Original AI generated"
                  className="w-full object-contain"
                />
              </div>
            ) : (
              <div className="border-2 border-stone-700 rounded-md bg-stone-900 min-h-[200px] flex items-center justify-center">
                <span className="text-stone-500 text-sm">No image yet</span>
              </div>
            )}
          </div>

          {/* Block Preview */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-stone-500">Blocks</span>
            <BlockPreview data={blockData} isLoading={isConverting} />
          </div>
        </div>
      )}

      {/* Stats */}
      {blockData && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-stone-800 border border-stone-700 rounded p-2 text-center">
            <div className="text-emerald-400 font-mono text-sm font-bold">
              {blockData.blockCount.toLocaleString()}
            </div>
            <div className="text-stone-500 text-xs">Total</div>
          </div>
          <div className="bg-stone-800 border border-stone-700 rounded p-2 text-center">
            <div className="text-emerald-400 font-mono text-sm font-bold">
              {Object.keys(blockData.paletteSummary).length}
            </div>
            <div className="text-stone-500 text-xs">Unique</div>
          </div>
          <div className="bg-stone-800 border border-stone-700 rounded p-2 text-center">
            <div className="text-emerald-400 font-mono text-sm font-bold">
              {blockData.dimensions.width}×{blockData.dimensions.height}
            </div>
            <div className="text-stone-500 text-xs">Size</div>
          </div>
          <div className="bg-stone-800 border border-stone-700 rounded p-2 text-center">
            <div className="text-emerald-400 font-mono text-sm font-bold">
              {Object.entries(blockData.paletteSummary)
                .sort((a, b) => b[1] - a[1])[0]?.[0]
                ?.replace('minecraft:', '')
                .replace(/_/g, ' ')
                .slice(0, 12) || '-'}
            </div>
            <div className="text-stone-500 text-xs">Most Used</div>
          </div>
        </div>
      )}
    </div>
  );
}
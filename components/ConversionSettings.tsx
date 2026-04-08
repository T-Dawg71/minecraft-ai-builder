'use client';

import { useState, useCallback } from 'react';

export interface ConversionSettingsData {
  gridWidth: number;
  gridHeight: number;
  palette: string;
  dithering: boolean;
  brightness: number;
  contrast: number;
}

interface ConversionSettingsProps {
  settings: ConversionSettingsData;
  onSettingsChange: (settings: ConversionSettingsData) => void;
  onReconvert: () => void;
  isConverting?: boolean;
}

const GRID_PRESETS = [
  { label: '32×32', w: 32, h: 32 },
  { label: '64×64', w: 64, h: 64 },
  { label: '128×128', w: 128, h: 128 },
  { label: '256×256', w: 256, h: 256 },
];

const PALETTE_OPTIONS = [
  { value: 'full', label: 'Full Palette (All Blocks)' },
  { value: 'survival', label: 'Survival Friendly' },
  { value: 'wool', label: 'Wool Only (16 colors)' },
  { value: 'concrete', label: 'Concrete Only (16 colors)' },
  { value: 'terracotta', label: 'Terracotta Only (17 colors)' },
  { value: 'natural', label: 'Natural Blocks' },
  { value: 'nether', label: 'Nether Blocks' },
  { value: 'vibrant', label: 'Vibrant Colors' },
];

export const DEFAULT_SETTINGS: ConversionSettingsData = {
  gridWidth: 64,
  gridHeight: 64,
  palette: 'full',
  dithering: false,
  brightness: 0,
  contrast: 0,
};

export default function ConversionSettings({
  settings,
  onSettingsChange,
  onReconvert,
  isConverting = false,
}: ConversionSettingsProps) {
  const [customSize, setCustomSize] = useState(false);

  const update = useCallback(
    (partial: Partial<ConversionSettingsData>) => {
      onSettingsChange({ ...settings, ...partial });
    },
    [settings, onSettingsChange]
  );

  const handlePresetClick = (w: number, h: number) => {
    setCustomSize(false);
    update({ gridWidth: w, gridHeight: h });
  };

  const isActivePreset = (w: number, h: number) =>
    !customSize && settings.gridWidth === w && settings.gridHeight === h;

  return (
    <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 space-y-5">
      <h2 className="text-lg font-semibold text-emerald-400">
        Conversion Settings
      </h2>

      {/* Grid Size */}
      <div>
        <label className="block text-sm text-stone-300 mb-2">Grid Size (blocks)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {GRID_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.w, preset.h)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                isActivePreset(preset.w, preset.h)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setCustomSize(true)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              customSize
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            Custom
          </button>
        </div>
        {customSize && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={8}
              max={512}
              value={settings.gridWidth}
              onChange={(e) => update({ gridWidth: parseInt(e.target.value) || 8 })}
              className="w-20 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-100"
            />
            <span className="text-stone-400">×</span>
            <input
              type="number"
              min={8}
              max={512}
              value={settings.gridHeight}
              onChange={(e) => update({ gridHeight: parseInt(e.target.value) || 8 })}
              className="w-20 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-100"
            />
          </div>
        )}
      </div>

      {/* Palette */}
      <div>
        <label className="block text-sm text-stone-300 mb-2">Block Palette</label>
        <select
          value={settings.palette}
          onChange={(e) => update({ palette: e.target.value })}
          className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-sm text-stone-100"
        >
          {PALETTE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dithering */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-stone-300">Floyd-Steinberg Dithering</label>
        <button
          onClick={() => update({ dithering: !settings.dithering })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.dithering ? 'bg-emerald-600' : 'bg-stone-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              settings.dithering ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Brightness */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-sm text-stone-300">Brightness</label>
          <span className="text-sm text-stone-400">{settings.brightness}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={settings.brightness}
          onChange={(e) => update({ brightness: parseInt(e.target.value) })}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Contrast */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-sm text-stone-300">Contrast</label>
          <span className="text-sm text-stone-400">{settings.contrast}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={settings.contrast}
          onChange={(e) => update({ contrast: parseInt(e.target.value) })}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Re-convert Button */}
      <button
        onClick={onReconvert}
        disabled={isConverting}
        className="w-full py-2.5 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        {isConverting ? 'Converting...' : 'Re-convert with New Settings'}
      </button>
    </div>
  );
}
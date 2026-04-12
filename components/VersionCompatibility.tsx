'use client';

import { useState, useMemo } from 'react';

export type MinecraftVersion = '1.16' | '1.17' | '1.18' | '1.19' | '1.20' | '1.21';

interface VersionCompatibilityProps {
  selectedVersion: MinecraftVersion;
  onVersionChange: (version: MinecraftVersion) => void;
  usedBlocks?: string[];
}

const VERSIONS: { value: MinecraftVersion; label: string }[] = [
  { value: '1.16', label: '1.16 (Nether Update)' },
  { value: '1.17', label: '1.17 (Caves & Cliffs Part 1)' },
  { value: '1.18', label: '1.18 (Caves & Cliffs Part 2)' },
  { value: '1.19', label: '1.19 (The Wild Update)' },
  { value: '1.20', label: '1.20 (Trails & Tales)' },
  { value: '1.21', label: '1.21 (Tricky Trials)' },
];

// Blocks added in each version (blocks not available in earlier versions)
const VERSION_BLOCKS: Record<string, MinecraftVersion> = {
  // 1.17 additions
  'minecraft:deepslate': '1.17',
  'minecraft:cobbled_deepslate': '1.17',
  'minecraft:polished_deepslate': '1.17',
  'minecraft:deepslate_bricks': '1.17',
  'minecraft:deepslate_tiles': '1.17',
  'minecraft:tuff': '1.17',
  'minecraft:calcite': '1.17',
  'minecraft:dripstone_block': '1.17',
  'minecraft:copper_block': '1.17',
  'minecraft:exposed_copper': '1.17',
  'minecraft:weathered_copper': '1.17',
  'minecraft:oxidized_copper': '1.17',
  'minecraft:raw_iron_block': '1.17',
  'minecraft:raw_copper_block': '1.17',
  'minecraft:raw_gold_block': '1.17',
  'minecraft:amethyst_block': '1.17',
  'minecraft:moss_block': '1.17',
  'minecraft:smooth_basalt': '1.17',

  // 1.19 additions
  'minecraft:mud': '1.19',
  'minecraft:packed_mud': '1.19',
  'minecraft:mud_bricks': '1.19',
  'minecraft:mangrove_planks': '1.19',
  'minecraft:mangrove_log': '1.19',
  'minecraft:sculk': '1.19',
  'minecraft:ochre_froglight': '1.19',
  'minecraft:verdant_froglight': '1.19',
  'minecraft:pearlescent_froglight': '1.19',

  // 1.20 additions
  'minecraft:cherry_planks': '1.20',
  'minecraft:cherry_log': '1.20',
  'minecraft:bamboo_planks': '1.20',
};

const FORMAT_SUPPORT: Record<string, { schem: string; nbt: string }> = {
  '1.16': { schem: 'WorldEdit 7.2+', nbt: 'Vanilla' },
  '1.17': { schem: 'WorldEdit 7.2+', nbt: 'Vanilla' },
  '1.18': { schem: 'WorldEdit 7.2+', nbt: 'Vanilla' },
  '1.19': { schem: 'WorldEdit 7.2+', nbt: 'Vanilla' },
  '1.20': { schem: 'WorldEdit 7.2+', nbt: 'Vanilla' },
  '1.21': { schem: 'WorldEdit 7.3+', nbt: 'Vanilla' },
};

function versionToNum(v: MinecraftVersion): number {
  return parseFloat(v);
}

export default function VersionCompatibility({
  selectedVersion,
  onVersionChange,
  usedBlocks = [],
}: VersionCompatibilityProps) {
  const incompatibleBlocks = useMemo(() => {
    const selectedNum = versionToNum(selectedVersion);
    return usedBlocks.filter((blockId) => {
      const minVersion = VERSION_BLOCKS[blockId];
      if (!minVersion) return false;
      return versionToNum(minVersion) > selectedNum;
    });
  }, [selectedVersion, usedBlocks]);

  const formatInfo = FORMAT_SUPPORT[selectedVersion];

  return (
    <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-emerald-400">
        Minecraft Version
      </h2>

      <select
        value={selectedVersion}
        onChange={(e) => onVersionChange(e.target.value as MinecraftVersion)}
        className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-sm text-stone-100"
      >
        {VERSIONS.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>

      {/* Format support */}
      {formatInfo && (
        <div className="text-xs text-stone-400 space-y-1">
          <div className="flex justify-between">
            <span>.schem support:</span>
            <span className="text-stone-300">{formatInfo.schem}</span>
          </div>
          <div className="flex justify-between">
            <span>.nbt support:</span>
            <span className="text-stone-300">{formatInfo.nbt}</span>
          </div>
        </div>
      )}

      {/* Incompatible blocks warning */}
      {incompatibleBlocks.length > 0 && (
        <div className="bg-stone-900 rounded p-3 space-y-2">
          <p className="text-amber-400 text-xs font-medium">
            ⚠️ {incompatibleBlocks.length} block{incompatibleBlocks.length > 1 ? 's' : ''} not available in {selectedVersion}
          </p>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {incompatibleBlocks.map((blockId) => (
              <div key={blockId} className="flex justify-between text-xs">
                <span className="text-stone-400">
                  {blockId.replace('minecraft:', '').replace(/_/g, ' ')}
                </span>
                <span className="text-stone-500">
                  requires {VERSION_BLOCKS[blockId]}+
                </span>
              </div>
            ))}
          </div>
          <p className="text-stone-500 text-xs">
            These blocks will be replaced with the closest available alternative during export.
          </p>
        </div>
      )}

      {incompatibleBlocks.length === 0 && usedBlocks.length > 0 && (
        <p className="text-emerald-400 text-xs">
          ✅ All blocks are compatible with Minecraft {selectedVersion}
        </p>
      )}
    </div>
  );
}
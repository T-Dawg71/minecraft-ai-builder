'use client';

import { useState } from 'react';

type GuideSection = 'worldedit' | 'structure' | 'litematica' | 'troubleshooting';

const SECTIONS: { key: GuideSection; title: string; icon: string }[] = [
  { key: 'worldedit', title: 'WorldEdit (.schem)', icon: '⚔️' },
  { key: 'structure', title: 'Structure Blocks (.nbt)', icon: '🧱' },
  { key: 'litematica', title: 'Litematica (Bonus)', icon: '📐' },
  { key: 'troubleshooting', title: 'Troubleshooting', icon: '🔧' },
];

export default function ImportGuide() {
  const [openSection, setOpenSection] = useState<GuideSection | null>(null);

  const toggle = (key: GuideSection) => {
    setOpenSection(openSection === key ? null : key);
  };

  return (
    <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 space-y-2">
      <h2 className="text-lg font-semibold text-emerald-400 mb-3">
        Import Into Minecraft
      </h2>

      {SECTIONS.map(({ key, title, icon }) => (
        <div key={key} className="border border-stone-700 rounded">
          <button
            onClick={() => toggle(key)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-700/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-stone-200">
              <span>{icon}</span>
              {title}
            </span>
            <span className="text-stone-400 text-xs">
              {openSection === key ? '▲' : '▼'}
            </span>
          </button>

          {openSection === key && (
            <div className="px-4 pb-4 text-sm text-stone-300 space-y-3">
              {key === 'worldedit' && <WorldEditGuide />}
              {key === 'structure' && <StructureBlockGuide />}
              {key === 'litematica' && <LitematicaGuide />}
              {key === 'troubleshooting' && <TroubleshootingGuide />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WorldEditGuide() {
  return (
    <div className="space-y-3">
      <p className="text-stone-400 text-xs italic">
        Recommended for builds of any size. Requires WorldEdit mod/plugin.
      </p>
      <div className="space-y-2">
        <Step number={1} title="Install WorldEdit">
          <p>Download WorldEdit for your Minecraft version:</p>
          <ul className="list-disc list-inside text-stone-400 text-xs space-y-1 mt-1">
            <li><strong>Forge/Fabric:</strong> Install the WorldEdit mod from CurseForge</li>
            <li><strong>Bukkit/Spigot/Paper:</strong> Install the WorldEdit plugin</li>
          </ul>
        </Step>
        <Step number={2} title="Place the .schem file">
          <p>Copy your downloaded <code className="bg-stone-900 px-1 rounded text-emerald-400">.schem</code> file into:</p>
          <code className="block bg-stone-900 px-3 py-2 rounded text-xs text-emerald-400 mt-1">
            .minecraft/config/worldedit/schematics/
          </code>
          <p className="text-stone-400 text-xs mt-1">
            For servers: <code className="bg-stone-900 px-1 rounded">plugins/WorldEdit/schematics/</code>
          </p>
        </Step>
        <Step number={3} title="Load the schematic in-game">
          <p>Open Minecraft, go to where you want to place the build, and run:</p>
          <code className="block bg-stone-900 px-3 py-2 rounded text-xs text-emerald-400 mt-1">
            //schem load filename
          </code>
          <p className="text-stone-400 text-xs mt-1">
            (without the .schem extension)
          </p>
        </Step>
        <Step number={4} title="Paste the build">
          <p>Stand where you want the build placed and run:</p>
          <code className="block bg-stone-900 px-3 py-2 rounded text-xs text-emerald-400 mt-1">
            //paste
          </code>
          <p className="text-stone-400 text-xs mt-1">
            Use <code className="bg-stone-900 px-1 rounded">//undo</code> if you need to reposition.
          </p>
        </Step>
      </div>
    </div>
  );
}

function StructureBlockGuide() {
  return (
    <div className="space-y-3">
      <p className="text-stone-400 text-xs italic">
        Works in vanilla Minecraft — no mods required. Best for builds 48×48 or smaller.
      </p>
      <div className="space-y-2">
        <Step number={1} title="Place the .nbt file">
          <p>Copy your downloaded <code className="bg-stone-900 px-1 rounded text-emerald-400">.nbt</code> file into:</p>
          <code className="block bg-stone-900 px-3 py-2 rounded text-xs text-emerald-400 mt-1">
            .minecraft/saves/[world]/generated/minecraft/structures/
          </code>
          <p className="text-stone-400 text-xs mt-1">
            Create the <code className="bg-stone-900 px-1 rounded">structures</code> folder if it doesn't exist.
          </p>
        </Step>
        <Step number={2} title="Get a Structure Block">
          <p>In creative mode, run:</p>
          <code className="block bg-stone-900 px-3 py-2 rounded text-xs text-emerald-400 mt-1">
            /give @s minecraft:structure_block
          </code>
        </Step>
        <Step number={3} title="Place and configure the Structure Block">
          <p>Place the structure block where you want the build. Right-click it to open the GUI:</p>
          <ul className="list-disc list-inside text-stone-400 text-xs space-y-1 mt-1">
            <li>Set mode to <strong>Load</strong></li>
            <li>Enter the structure name (filename without .nbt)</li>
            <li>Click <strong>LOAD</strong></li>
          </ul>
        </Step>
        <Step number={4} title="Preview and place">
          <p>You should see a preview outline of the structure. Adjust the offset if needed, then click <strong>LOAD</strong> again to place the blocks.</p>
        </Step>
      </div>
      <div className="bg-stone-900 rounded p-3 mt-2">
        <p className="text-amber-400 text-xs font-medium">⚠️ Size Limit</p>
        <p className="text-stone-400 text-xs mt-1">
          Vanilla structure blocks are limited to 48×48×48 blocks. For larger builds, use WorldEdit (.schem) instead.
        </p>
      </div>
    </div>
  );
}

function LitematicaGuide() {
  return (
    <div className="space-y-3">
      <p className="text-stone-400 text-xs italic">
        Optional — for Litematica mod users. Convert .schem to .litematic first.
      </p>
      <div className="space-y-2">
        <Step number={1} title="Install Litematica">
          <p>Download Litematica for Fabric from CurseForge. Also requires MaLiLib.</p>
        </Step>
        <Step number={2} title="Convert .schem to .litematic">
          <p>Open Litematica in-game, use the schematic browser to load the .schem file, then save as .litematic.</p>
          <p className="text-stone-400 text-xs mt-1">
            Alternatively, use an online converter tool.
          </p>
        </Step>
        <Step number={3} title="Place with Litematica">
          <p>Use Litematica's placement tools to position and place the build with a holographic preview overlay.</p>
        </Step>
      </div>
    </div>
  );
}

function TroubleshootingGuide() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Issue
          problem="'Unknown schematic' error in WorldEdit"
          solution="Make sure the file has the .schem extension (not .schematic). Check that the file is in the correct schematics folder."
        />
        <Issue
          problem="Structure block says 'Structure not found'"
          solution="Verify the .nbt file is in the correct folder: .minecraft/saves/[world]/generated/minecraft/structures/. The name must match exactly (case-sensitive, no extension)."
        />
        <Issue
          problem="Build appears rotated or upside down"
          solution="Check the orientation setting (Wall vs Floor) in the export panel. Wall mode places the image vertically, Floor mode places it flat on the ground."
        />
        <Issue
          problem="Colors look wrong in Minecraft"
          solution="Block colors vary slightly between Minecraft versions and resource packs. The converter uses default texture colors. Try a different palette preset for better results."
        />
        <Issue
          problem="Build is too large for structure blocks"
          solution="Vanilla structure blocks have a 48×48×48 limit. Use a smaller grid size (32×32) or switch to WorldEdit (.schem) which has no size limit."
        />
        <Issue
          problem="Some blocks are missing in my Minecraft version"
          solution="Use the version compatibility selector in export settings. Newer block types (e.g., cherry planks, bamboo) require Minecraft 1.20+."
        />
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
        {number}
      </div>
      <div className="flex-1">
        <p className="font-medium text-stone-200 text-sm">{title}</p>
        <div className="text-stone-400 text-xs mt-1">{children}</div>
      </div>
    </div>
  );
}

function Issue({ problem, solution }: { problem: string; solution: string }) {
  return (
    <div className="bg-stone-900 rounded p-3">
      <p className="text-red-400 text-xs font-medium">❌ {problem}</p>
      <p className="text-stone-400 text-xs mt-1">✅ {solution}</p>
    </div>
  );
}

## Formats Evaluated

### .schematic (MCEdit)
The original schematic format introduced by MCEdit. Stores block IDs as legacy numeric values and is limited to a 65,535 block height. It has poor support in modern tooling and is largely considered deprecated. Most modern editors and mods have dropped or reduced support for it.

### .nbt (Vanilla)
The native binary format used by Minecraft's structure block system. Fully supported by vanilla Minecraft with no mods required. Stores block states using modern string-based IDs (e.g. `minecraft:grass_block[snowy=false]`). Limited to a 48×48×48 bounding box per structure file, which is a significant constraint for larger builds.

### .schem (WorldEdit)
The modern schematic format introduced by WorldEdit (FAWE/Sponge). Stores block states using the same string-based ID system as vanilla. Supports arbitrarily large structures with no bounding box limit. Widely supported across the modded Minecraft ecosystem including WorldEdit, FAWE, Litematica (via conversion), and most modern build tools.

### .litematic (Litematica)
A format specific to the Litematica mod. Stores full block state data and supports large structures. However it is tied to a single mod with no broad ecosystem support, making it a poor choice as a primary export target.

---

## Decision

| Format | Role | Reason |
|---|---|---|
| `.schem` | Primary | Modern block state support, no size limits, wide ecosystem compatibility |
| `.nbt` | Secondary | Vanilla compatibility, no mods required for import |

**.schem is the primary export format.** It is the best fit for this project because the block grids generated can exceed 48×48 (especially at 128×128 or 256×256 grid sizes), which immediately rules out .nbt as a primary format. The .schem format handles arbitrary sizes, uses modern string-based block IDs that align with how blocks are stored in our `BlockGrid` type, and is supported by the most widely used Minecraft building tools.

**.nbt is the secondary export format.** It requires no mods to import, making it accessible to vanilla Minecraft users. It is most useful for smaller builds (32×32 or 64×64 grid sizes) that stay within the 48×48×48 vanilla structure block limit.

**.schematic and .litematic are not supported.** .schematic is a legacy format with deprecated numeric block IDs that do not map cleanly to our data model. .litematic is mod-specific with no broad ecosystem support.

---

## Format Specs

### .schem (WorldEdit Sponge Schematic)
- **Encoding:** NBT (binary), gzip compressed
- **Block storage:** Palette of block states + flat integer array of palette indices
- **Block state format:** `minecraft:block_name[property=value]`
- **Size limit:** None
- **Spec reference:** [EngineHub Sponge Schematic Specification](https://github.com/EngineHub/WorldEdit/blob/master/worldedit-core/src/main/java/com/sk89q/worldedit/extent/clipboard/io/SpongeSchematicWriter.java)

### .nbt (Vanilla Structure)
- **Encoding:** NBT (binary), gzip compressed
- **Block storage:** Palette list + 3D position array of palette indices
- **Block state format:** `{Name: "minecraft:block_name", Properties: {property: "value"}}`
- **Size limit:** 48×48×48 blocks per file
- **Spec reference:** [Minecraft Wiki — Structure file format](https://minecraft.wiki/w/Structure_file_format)
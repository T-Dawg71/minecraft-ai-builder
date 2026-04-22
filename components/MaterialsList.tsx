"use client";

import { useMemo, useState, memo } from "react";
import { rgbToCssColor, type BlockGridData } from "@/components/BlockPreview";

type SortKey = "quantity" | "name" | "color";
type SortDirection = "asc" | "desc";

interface MaterialsListProps {
  blockData: BlockGridData;
}

interface MaterialRow {
  blockId: string;
  blockName: string;
  quantity: number;
  percentage: number;
  colorCss: string;
  colorSortValue: number;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatDecimal(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function titleCaseBlockName(blockId: string) {
  return blockId
    .split(":")
    .pop()
    ?.split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") ?? blockId;
}

function buildMaterialRows(blockData: BlockGridData): MaterialRow[] {
  const counts = new Map<string, number>();

  for (const row of blockData.grid) {
    for (const blockId of row) {
      counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
    }
  }

  const totalBlocks = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(counts.entries()).map(([blockId, quantity]) => {
    const rgb = blockData.colors[blockId] ?? [128, 128, 128];
    const [red, green, blue] = rgb;
    return {
      blockId,
      blockName: titleCaseBlockName(blockId),
      quantity,
      percentage: totalBlocks > 0 ? (quantity / totalBlocks) * 100 : 0,
      colorCss: rgbToCssColor(rgb),
      colorSortValue: red * 1_000_000 + green * 1_000 + blue,
    };
  });
}

function sortRows(rows: MaterialRow[], sortKey: SortKey, sortDirection: SortDirection) {
  const multiplier = sortDirection === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const comparison =
      sortKey === "quantity"
        ? left.quantity - right.quantity
        : sortKey === "name"
          ? left.blockName.localeCompare(right.blockName)
          : left.colorSortValue - right.colorSortValue;

    if (comparison !== 0) {
      return comparison * multiplier;
    }

    return left.blockName.localeCompare(right.blockName);
  });
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function MaterialsList({ blockData }: MaterialsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("quantity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const baseRows = useMemo(() => buildMaterialRows(blockData), [blockData]);
  const rows = useMemo(() => sortRows(baseRows, sortKey, sortDirection), [baseRows, sortKey, sortDirection]);

  const totals = useMemo(() => {
    const totalBlocks = baseRows.reduce((sum, row) => sum + row.quantity, 0);
    const uniqueTypes = baseRows.length;
    const estimatedStacks = totalBlocks / 64;
    const estimatedShulkers = estimatedStacks / 27;
    return { totalBlocks, uniqueTypes, estimatedStacks, estimatedShulkers };
  }, [baseRows]);

  const clipboardText = useMemo(() => {
    const header = ["Block Name", "Block ID", "Quantity", "% of Total"].join("\t");
    const lines = rows.map((row) =>
      [row.blockName, row.blockId, String(row.quantity), `${row.percentage.toFixed(2)}%`].join("\t")
    );
    const summary = [
      `Total Blocks\t${totals.totalBlocks}`,
      `Unique Types\t${totals.uniqueTypes}`,
      `Estimated Stacks\t${totals.estimatedStacks.toFixed(2)}`,
      `Estimated Shulker Boxes\t${totals.estimatedShulkers.toFixed(2)}`,
    ];
    return [header, ...lines, "", ...summary].join("\n");
  }, [rows, totals]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "quantity" ? "desc" : "asc");
  }

  async function handleCopy() {
    try {
      await copyTextToClipboard(clipboardText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-mc-stone-300 bg-white shadow-[0_18px_45px_rgba(50,50,48,0.08)]">
      <div className="flex items-center justify-between border-b border-mc-stone-300 px-5 py-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-mc-stone-500">Materials List</p>
          <h2 className="mt-1 font-mono text-lg font-bold uppercase tracking-wide text-mc-stone-900">
            Build Inventory
          </h2>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-mc-stone-300 bg-mc-stone-100 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide text-mc-stone-800 transition hover:bg-mc-stone-200"
        >
          {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy Failed" : "Copy to Clipboard"}
        </button>
      </div>

      <div className="grid gap-2 border-b border-mc-stone-300 bg-mc-stone-50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Blocks",      value: formatNumber(totals.totalBlocks) },
          { label: "Unique Types",      value: formatNumber(totals.uniqueTypes) },
          { label: "Estimated Stacks",  value: formatDecimal(totals.estimatedStacks) },
          { label: "Shulker Boxes",     value: formatDecimal(totals.estimatedShulkers) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-mc-stone-300 bg-white px-3 py-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-mc-stone-500">{item.label}</p>
            <p className="mt-1 font-mono text-lg font-bold text-mc-stone-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse font-mono text-sm">
          <thead className="bg-mc-stone-100 text-xs uppercase tracking-widest text-mc-stone-600">
            <tr>
              <th className="px-4 py-3 text-left">
                <button type="button" onClick={() => handleSort("color")} className="transition hover:text-mc-stone-900">
                  Color {sortKey === "color" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button type="button" onClick={() => handleSort("name")} className="transition hover:text-mc-stone-900">
                  Block Name {sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-4 py-3 text-left">Block ID</th>
              <th className="px-4 py-3 text-right">
                <button type="button" onClick={() => handleSort("quantity")} className="transition hover:text-mc-stone-900">
                  Quantity {sortKey === "quantity" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-4 py-3 text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.blockId} className="border-t border-mc-stone-200 text-mc-stone-800 even:bg-mc-stone-50/60">
                <td className="px-4 py-3">
                  <span
                    className="block h-6 w-6 rounded-md border border-mc-stone-300 shadow-inner"
                    style={{ backgroundColor: row.colorCss }}
                    title={row.colorCss}
                  />
                </td>
                <td className="px-4 py-3 font-bold">{row.blockName}</td>
                <td className="px-4 py-3 text-xs text-mc-stone-600">{row.blockId}</td>
                <td className="px-4 py-3 text-right font-bold">{formatNumber(row.quantity)}</td>
                <td className="px-4 py-3 text-right">{row.percentage.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default memo(MaterialsList);
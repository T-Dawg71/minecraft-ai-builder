import { materializeBlockGrid } from "@/components/BlockPreview";
import type { BlockGridData, BlockGrid } from "@/components/BlockPreview";

self.onmessage = (e: MessageEvent<BlockGridData>) => {
  const result: BlockGrid = materializeBlockGrid(e.data);
  self.postMessage(result);
};
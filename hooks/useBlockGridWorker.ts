import { useState, useEffect, useRef } from "react";
import type { BlockGridData, BlockGrid } from "@/components/BlockPreview";

export function useBlockGridWorker(blockData: BlockGridData | null) {
  const [grid, setGrid] = useState<BlockGrid | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!blockData) {
      setGrid(null);
      return;
    }

    setIsProcessing(true);

    const worker = new Worker(
      new URL("../workers/blockGrid.worker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<BlockGrid>) => {
      setGrid(e.data);
      setIsProcessing(false);
      worker.terminate();
    };

    worker.onerror = () => {
      setIsProcessing(false);
      worker.terminate();
    };

    worker.postMessage(blockData);

    return () => {
      worker.terminate();
    };
  }, [blockData]);

  return { grid, isProcessing };
}
import { useState, useCallback } from "react";
import type { PipelineStep } from "@/components/PipelineStatus";
import type { BlockGrid } from "@/components/BlockPreview";
import type { ConversionConfig } from "@/components/ConversionSettings";

interface GenerationState {
  input:         string;
  refinedPrompt: string;
  imageBase64:   string;
  blockGrid:     BlockGrid | null;
  step:          PipelineStep;
  isLoading:     boolean;
  error:         string;
}

const INITIAL: GenerationState = {
  input:         "",
  refinedPrompt: "",
  imageBase64:   "",
  blockGrid:     null,
  step:          "idle",
  isLoading:     false,
  error:         "",
};

export function useImageGeneration() {
  const [state, setState] = useState<GenerationState>(INITIAL);

  const setPartial = (patch: Partial<GenerationState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const run = useCallback(async (input: string) => {
    if (!input.trim()) return;

    setPartial({ isLoading: true, error: "", step: "refining", input });

    // --- Step 1: refine prompt ---
    let refined = "";
    try {
      const res = await fetch("/api/refine-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });
      if (!res.ok) throw new Error(`Refine failed: ${res.status}`);
      const data = await res.json();
      refined = data.refinedPrompt ?? data.refined_prompt ?? data.result ?? data.refined ?? "";
      if (!refined) throw new Error("No refined prompt returned.");
      setPartial({ refinedPrompt: refined, step: "generating" });
    } catch (err) {
      setPartial({
        step: "error",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to refine prompt.",
      });
      return;
    }

    // --- Step 2: generate image ---
    let imageBase64 = "";
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: refined }),
      });
      if (!res.ok) throw new Error(`Image generation failed: ${res.status}`);
      const data = await res.json();
      imageBase64 = data.image ?? data.imageBase64 ?? data.base64 ?? "";
      if (!imageBase64) throw new Error("No image data returned.");
      setPartial({ imageBase64, step: "converting" });
    } catch (err) {
      setPartial({
        step: "error",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to generate image.",
      });
      return;
    }

    // --- Step 3: convert image to block grid ---
    try {
      const res = await fetch("/api/convert-to-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
      });
      if (!res.ok) throw new Error(`Block conversion failed: ${res.status}`);
      const data = await res.json();
      const blockGrid: BlockGrid = data.grid;
      if (!blockGrid) throw new Error("No block grid returned.");
      setPartial({ blockGrid, step: "done", isLoading: false });
    } catch (err) {
      setPartial({
        step: "error",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to convert to blocks.",
      });
    }
  }, []);

  // --- Re-convert: re-runs only step 3 with new settings ---
  const reconvert = useCallback(async (imageBase64: string, config: ConversionConfig) => {
    if (!imageBase64) return;
    setPartial({ isLoading: true, error: "", step: "converting" });
    try {
      const res = await fetch("/api/convert-to-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image:      imageBase64,
          gridSize:   config.gridSize,
          palette:    config.palette.blocks,
          dithering:  config.dithering,
          brightness: config.brightness,
          contrast:   config.contrast,
          depth:      config.depth,
          depthMode:  config.depthMode,
        }),
      });
      if (!res.ok) throw new Error(`Block conversion failed: ${res.status}`);
      const data = await res.json();
      const blockGrid: BlockGrid = data.grid;
      if (!blockGrid) throw new Error("No block grid returned.");
      setPartial({ blockGrid, step: "done", isLoading: false });
    } catch (err) {
      setPartial({
        step: "error",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to re-convert.",
      });
    }
  }, []);

  const retry = useCallback(() => { if (state.input) run(state.input); }, [state.input, run]);
  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, retry, reset, reconvert };
}
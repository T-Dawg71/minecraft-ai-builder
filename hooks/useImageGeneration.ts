import { useState, useCallback } from "react";
import type { PipelineStep } from "@/components/PipelineStatus";
import type { BlockGridData } from "@/components/BlockPreview";
import type { ConversionSettingsData } from "@/components/ConversionSettings";
import { DEFAULT_SETTINGS } from "@/components/ConversionSettings";

interface GenerationState {
  input: string;
  refinedPrompt: string;
  imageBase64: string;
  blockData: BlockGridData | null;
  step: PipelineStep;
  isLoading: boolean;
  isConverting: boolean;
  error: string;
  settings: ConversionSettingsData;
}

const INITIAL: GenerationState = {
  input: "",
  refinedPrompt: "",
  imageBase64: "",
  blockData: null,
  step: "idle",
  isLoading: false,
  isConverting: false,
  error: "",
  settings: DEFAULT_SETTINGS,
};

export function useImageGeneration() {
  const [state, setState] = useState<GenerationState>(INITIAL);

  const setPartial = (patch: Partial<GenerationState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const convertToBlocks = useCallback(
    async (imageBase64: string, settings: ConversionSettingsData) => {
      setPartial({ isConverting: true, step: "converting" });

      try {
        const res = await fetch("/api/convert-to-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: imageBase64,
            width: settings.gridWidth,
            height: settings.gridHeight,
            palette: settings.palette,
            dithering: settings.dithering,
            brightness: settings.brightness,
            contrast: settings.contrast,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.detail || `Conversion failed: ${res.status}`);
        }

        const data = await res.json();

        // Build the colors map from the grid + block_colors
        const colorsMap: { [blockId: string]: number[] } = {};
        if (data.grid) {
          // Fetch block colors to build the color lookup
          for (const row of data.grid) {
            for (const blockId of row) {
              if (!colorsMap[blockId]) {
                // We'll populate this from palette_summary or a separate call
                colorsMap[blockId] = [128, 128, 128]; // placeholder
              }
            }
          }
        }

        // If the backend returns colors, use them; otherwise fetch from block_colors endpoint
        if (data.colors) {
          Object.assign(colorsMap, data.colors);
        } else {
          // Fetch the block colors
          try {
            const colorsRes = await fetch("/api/block-colors");
            if (colorsRes.ok) {
              const blockColors = await colorsRes.json();
              for (const block of blockColors) {
                if (colorsMap[block.id] !== undefined) {
                  colorsMap[block.id] = block.rgb;
                }
              }
            }
          } catch {
            // Fall back to placeholders — non-critical
          }
        }

        const blockData: BlockGridData = {
          grid: data.grid,
          colors: colorsMap,
          dimensions: data.dimensions,
          blockCount: data.block_count,
          paletteSummary: data.palette_summary,
        };

        setPartial({ blockData, step: "done", isConverting: false, isLoading: false });
      } catch (err) {
        setPartial({
          step: "error",
          isConverting: false,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to convert to blocks.",
        });
      }
    },
    []
  );

  const run = useCallback(
    async (input: string, settings?: ConversionSettingsData) => {
      if (!input.trim()) return;

      const activeSettings = settings || state.settings;
      setPartial({ isLoading: true, error: "", step: "refining", input, blockData: null });

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
        setPartial({ imageBase64 });
      } catch (err) {
        setPartial({
          step: "error",
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to generate image.",
        });
        return;
      }

      // --- Step 3: convert to blocks ---
      await convertToBlocks(imageBase64, activeSettings);
    },
    [state.settings, convertToBlocks]
  );

  const reconvert = useCallback(
    async (settings: ConversionSettingsData) => {
      if (!state.imageBase64) return;
      setPartial({ settings });
      await convertToBlocks(state.imageBase64, settings);
    },
    [state.imageBase64, convertToBlocks]
  );

  const updateSettings = useCallback((settings: ConversionSettingsData) => {
    setPartial({ settings });
  }, []);

  const retry = useCallback(() => {
    if (state.input) run(state.input, state.settings);
  }, [state.input, state.settings, run]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, retry, reset, reconvert, updateSettings };
}
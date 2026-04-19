import { useState, useCallback } from "react";
import type { PipelineStep } from "@/components/PipelineStatus";
import type { BlockGridData } from "@/components/BlockPreview";
import type { ConversionSettingsData } from "@/components/ConversionSettings";
import { DEFAULT_SETTINGS } from "@/components/ConversionSettings";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface GenerationState {
  input: string;
  refinedPrompt: string;
  negativePrompt: string; // NEW
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
  negativePrompt: "", // NEW
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

  const setInput = useCallback((val: string) => {
    setPartial({ input: val });
  }, []);

  const convertToBlocks = useCallback(
    async (imageBase64: string, settings: ConversionSettingsData, inputPrompt?: string, refinedPrompt?: string) => {
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

        const colorsMap: { [blockId: string]: number[] } = {};
        if (data.grid) {
          for (const row of data.grid) {
            for (const blockId of row) {
              if (!colorsMap[blockId]) {
                colorsMap[blockId] = [128, 128, 128];
              }
            }
          }
        }

        if (data.colors) {
          Object.assign(colorsMap, data.colors);
        } else {
          try {
            const colorsRes = await fetch("/api/block-colors");
            if (colorsRes.ok) {
              const blockColors = await colorsRes.json();
              for (const block of blockColors) {
                if (colorsMap[block.id] !== undefined) {
                  colorsMap[block.id] = block.rgb;
                }
              }
              console.log("After update, lime_wool:", colorsMap["minecraft:lime_wool"]);
            }
          } catch {
            // Fall back to placeholders
          }
        }

        const blockData: BlockGridData = {
          grid: data.grid,
          colors: colorsMap,
          dimensions: data.dimensions,
          blockCount: data.block_count,
          paletteSummary: data.palette_summary,
        };

        console.log("Debug colors:", JSON.stringify({
          gridSample: data.grid?.[0]?.slice(0, 3),
          hasColors: !!data.colors,
          colorMatch: data.colors?.[data.grid?.[0]?.[0]],
        }));

        setPartial({ blockData, step: "done", isConverting: false, isLoading: false });

        // --- Save to history ---
        try {
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_prompt: inputPrompt ?? "",
              refined_prompt: refinedPrompt ?? "",
              image_base64: imageBase64,
            }),
          });
        } catch {
          // History save failure is non-fatal — don't surface to user
        }

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
    async (input: string) => {
      if (!input.trim()) return;

      const activeSettings = state.settings;
      const promptToGenerate = input.trim();
      const negative = "";
      setPartial({
        isLoading: true,
        error: "",
        step: "generating",
        input,
        blockData: null,
        refinedPrompt: promptToGenerate,
        negativePrompt: negative,
      });

      // --- Step 1: generate image ---
      let imageBase64 = "";
      try {
        const res = await fetch(`/api/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptToGenerate,
            negative_prompt: negative || undefined, // NEW: pass negative to SD
          }),
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

      // --- Step 2: convert to blocks ---
      await convertToBlocks(imageBase64, activeSettings, input, promptToGenerate);
    },
    [state.settings, convertToBlocks]
  );

  const reconvert = useCallback(
    async (settings: ConversionSettingsData, imageBase64Override?: string) => {
      const sourceImage = imageBase64Override || state.imageBase64;
      if (!sourceImage) return;
      setPartial({ settings });
      await convertToBlocks(sourceImage, settings, state.input, state.refinedPrompt);
    },
    [state.imageBase64, state.input, state.refinedPrompt, convertToBlocks]
  );

  const updateSettings = useCallback((settings: ConversionSettingsData) => {
    setPartial({ settings });
  }, []);

  const retry = useCallback(() => {
    if (state.input) run(state.input);
  }, [state.input, run]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, retry, reset, reconvert, updateSettings, setInput };
}
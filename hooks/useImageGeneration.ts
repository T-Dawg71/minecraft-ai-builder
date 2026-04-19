import { useState, useCallback } from "react";
import type { PipelineStep } from "@/components/PipelineStatus";
import type { BlockGridData } from "@/components/BlockPreview";
import type { ConversionSettingsData } from "@/components/ConversionSettings";
import { DEFAULT_SETTINGS } from "@/components/ConversionSettings";

interface GenerationState {
  input: string;
  refinedPrompt: string;
  negativePrompt: string;
  imageBase64: string;
  blockData: BlockGridData | null;
  step: PipelineStep;
  isLoading: boolean;
  isConverting: boolean;
  error: string;
  settings: ConversionSettingsData;
}

const makeInitial = (): GenerationState => ({
  input: "",
  refinedPrompt: "",
  negativePrompt: "",
  imageBase64: "",
  blockData: null,
  step: "idle",
  isLoading: false,
  isConverting: false,
  error: "",
  settings: DEFAULT_SETTINGS,
});

// Translate raw HTTP/network errors into friendly messages
function friendlyError(err: unknown, context: "image" | "convert"): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("503") || msg.toLowerCase().includes("unavailable")) {
    return context === "image"
      ? "Stable Diffusion is not running. Please start the SD service and try again."
      : "The backend service is unavailable. Please make sure it is running.";
  }
  if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
    return context === "image"
      ? "Image generation timed out. SD may be busy — please try again."
      : "Block conversion timed out. Try a smaller grid size.";
  }
  if (msg.includes("500")) {
    return context === "image"
      ? "Something went wrong generating the image. Please try again."
      : "Something went wrong converting to blocks. Please try again.";
  }
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror")) {
    return "Cannot reach the server. Please check that the backend is running on port 8000.";
  }
  // Fall back to the raw message if we don't recognise it
  return msg;
}

export function useImageGeneration() {
  const [state, setState] = useState<GenerationState>(makeInitial);

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
          error: friendlyError(err, "convert"),
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
      const negative = "photograph, photo, realistic, 3D render, CGI, intricate, detailed, ornate, decorative, mandala, complex, pattern, busy, shadows, gradients, shading, glow, photorealistic, noise, film grain, dark background";

      setPartial({
        isLoading: true,
        error: "",
        step: "generating",
        input,
        blockData: null,
        refinedPrompt: promptToGenerate,
        negativePrompt: negative,
      });

      // --- Generate image ---
      let imageBase64 = "";
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptToGenerate,
            negative_prompt: negative,
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
          error: friendlyError(err, "image"),
        });
        return;
      }

      // --- Convert to blocks ---
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

  // Preserve the user's palette/settings across reset
  const reset = useCallback(() =>
    setState(prev => ({ ...makeInitial(), settings: prev.settings })),
  []);

  return { ...state, run, retry, reset, reconvert, updateSettings, setInput };
}
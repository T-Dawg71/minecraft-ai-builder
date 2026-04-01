import { useState, useCallback } from "react";
import type { PipelineStep } from "@/components/PipelineStatus";

interface GenerationState {
  input: string;
  refinedPrompt: string;
  imageBase64: string;
  step: PipelineStep;
  isLoading: boolean;
  error: string;
}

const INITIAL: GenerationState = {
  input:         "",
  refinedPrompt: "",
  imageBase64:   "",
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
      refined = data.refinedPrompt ?? data.refined_prompt ?? data.result ?? "";
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
      setPartial({ step: "converting" });
    } catch (err) {
      setPartial({
        step: "error",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to generate image.",
      });
      return;
    }

    // --- Step 3: converting (placeholder — extend when block conversion exists) ---
    // If you add a /api/convert-to-blocks route later, call it here.
    // For now we mark it done immediately after image is ready.
    setPartial({ imageBase64, step: "done", isLoading: false });
  }, []);

  const retry = useCallback(() => {
    if (state.input) run(state.input);
  }, [state.input, run]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, retry, reset };
}
"use client";

import PromptInput from "@/components/PromptInput";
import PipelineStatus from "@/components/PipelineStatus";
import { useImageGeneration } from "@/hooks/useImageGeneration";

export default function Home() {
  const {
    input,
    refinedPrompt,
    imageBase64,
    step,
    isLoading,
    error,
    run,
    retry,
    reset,
  } = useImageGeneration();

  return (
    <main className="flex flex-col items-center gap-8 px-4 py-10 max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold font-mono text-mc-green tracking-wide uppercase">
        Minecraft Creator
      </h1>

      {/* Input */}
      <section className="w-full">
        <PromptInput
          value={input}
          onChange={(val) => {
            // keep input in sync without triggering pipeline
            // run() receives the value directly so just reset if cleared
            if (!val) reset();
          }}
          onSubmit={() => run(input)}
          onClear={reset}
          isLoading={isLoading}
        />
      </section>

      {/* Pipeline status */}
      {step !== "idle" && (
        <section className="w-full">
          <PipelineStatus
            step={step}
            errorMessage={error}
            onRetry={retry}
          />
        </section>
      )}

      {/* Refined prompt */}
      {refinedPrompt && (
        <section className="w-full">
          <h2 className="text-xs font-mono text-mc-stone uppercase tracking-widest mb-1">
            Refined Prompt
          </h2>
          <p className="text-mc-light text-sm font-mono bg-mc-dark border border-mc-stone rounded-md px-3 py-2 leading-relaxed">
            {refinedPrompt}
          </p>
        </section>
      )}

      {/* Image preview */}
      {imageBase64 && (
        <section className="w-full">
          <h2 className="text-xs font-mono text-mc-stone uppercase tracking-widest mb-2">
            Generated Preview
          </h2>
          <div className="border-2 border-mc-stone rounded-md overflow-hidden bg-mc-dark">
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="Generated Minecraft creation"
              className="w-full object-contain"
            />
          </div>
        </section>
      )}
    </main>
  );
}
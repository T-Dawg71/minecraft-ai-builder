"use client";
import PromptInput from "@/components/PromptInput";
import PipelineStatus from "@/components/PipelineStatus";
import ComparisonView from "@/components/ComparisonView";
import ConversionSettings from "@/components/ConversionSettings";
import { useImageGeneration } from "@/hooks/useImageGeneration";

export default function Home() {
  const {
    input,
    refinedPrompt,
    imageBase64,
    blockData,
    step,
    isLoading,
    isConverting,
    error,
    settings,
    run,
    retry,
    reset,
    reconvert,
    updateSettings,
    setInput,
  } = useImageGeneration();

  return (
    <main className="flex flex-col lg:flex-row gap-6 px-4 py-10 max-w-7xl mx-auto w-full">
      {/* Left Column: Input & Settings */}
      <div className="lg:w-1/3 space-y-6">
        <h1 className="text-3xl font-bold font-mono text-mc-green tracking-wide uppercase">
          Minecraft Creator
        </h1>
        <PromptInput
          value={input}
          onChange={(val) => {
            setInput(val);
            if (!val) reset();
          }}
          onSubmit={() => run(input, settings)}
          onClear={reset}
          isLoading={isLoading}
        />
        {step !== "idle" && (
          <PipelineStatus step={step} errorMessage={error} onRetry={retry} />
        )}
        {refinedPrompt && (
          <div>
            <h2 className="text-xs font-mono text-stone-400 uppercase tracking-widest mb-1">
              Refined Prompt
            </h2>
            <p className="text-stone-300 text-sm font-mono bg-stone-800 border border-stone-700 rounded-md px-3 py-2 leading-relaxed">
              {refinedPrompt}
            </p>
          </div>
        )}
        <ConversionSettings
          settings={settings}
          onSettingsChange={updateSettings}
          onReconvert={() => reconvert(settings)}
          isConverting={isConverting}
        />
      </div>
      {/* Right Column: Preview & Comparison */}
      <div className="lg:w-2/3 space-y-6">
        <ComparisonView
          imageBase64={imageBase64 || null}
          blockData={blockData}
          isConverting={isConverting}
        />
        {!imageBase64 && !blockData && (
          <div className="bg-stone-800 rounded-lg border border-stone-700 p-8 min-h-[400px] flex items-center justify-center">
            <p className="text-stone-500 text-sm font-mono text-center">
              Enter a description and click Generate to see your creation
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
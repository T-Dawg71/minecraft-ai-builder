"use client";
import PromptInput from "@/components/PromptInput";
import PipelineStatus from "@/components/PipelineStatus";
import ComparisonView from "@/components/ComparisonView";
import ConversionSettings from "@/components/ConversionSettings";
import ExportPanel from "@/components/ExportPanel";
import ImportGuide from "@/components/ImportGuide";
import VersionCompatibility, { MinecraftVersion } from "@/components/VersionCompatibility";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { useState } from "react";
import HistoryGallery from "@/components/HistoryGallery";
import ImageEditor from "@/components/ImageEditor";

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

  const [mcVersion, setMcVersion] = useState<MinecraftVersion>("1.20");
  const [editedImageBase64, setEditedImageBase64] = useState<string | null>(null);

  const handleRemix = (prompt: string) => {
    setInput(prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const usedBlocks = blockData?.paletteSummary ? Object.keys(blockData.paletteSummary) : [];
  const conversionSourceImage = editedImageBase64 || imageBase64 || "";
  const previewImage = editedImageBase64 || imageBase64 || null;

  const showComparison = !!(imageBase64 || blockData);

  return (
    <main className="flex flex-col lg:flex-row flex-wrap gap-6 px-4 py-10 max-w-7xl mx-auto w-full">
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
          onSubmit={() => run(input)}
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
          onReconvert={() => reconvert(settings, conversionSourceImage)}
          hasImage={!!imageBase64}
          hasBlockData={!!blockData}
          isConverting={isConverting}
        />
        <VersionCompatibility
          selectedVersion={mcVersion}
          onVersionChange={setMcVersion}
          usedBlocks={usedBlocks}
        />
        <ImportGuide />
      </div>

      <div className="lg:w-2/3 space-y-6">
        <ImageEditor
          key={imageBase64 || "no-image"}
          imageBase64={imageBase64 || null}
          disabled={isConverting}
          onEditedImageChange={setEditedImageBase64}
        />
        {showComparison ? (
          <>
            <ComparisonView
              imageBase64={previewImage}
              blockData={blockData || null}
              isConverting={isConverting}
            />
            {blockData && (
              <ExportPanel
                blockData={blockData}
                initialDepth={settings.depth}
                mapArtMode={settings.mapArtMode}
              />
            )}
          </>
        ) : (
          <div className="bg-stone-800 rounded-lg border border-stone-700 p-8 min-h-[400px] flex items-center justify-center">
            <p className="text-stone-500 text-sm font-mono text-center">
              Enter a description and click Generate to see your creation
            </p>
          </div>
        )}
      </div>

      {/* History gallery — full width below the two columns */}
      <div className="w-full mt-6">
        <HistoryGallery onRemix={handleRemix} />
      </div>
    </main>
  );
}
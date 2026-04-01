"use client";

export type PipelineStep =
  | "idle"
  | "refining"
  | "generating"
  | "converting"
  | "done"
  | "error";

interface PipelineStatusProps {
  step: PipelineStep;
  errorMessage?: string;
  onRetry?: () => void;
}

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: "refining",   label: "Refining prompt"     },
  { key: "generating", label: "Generating image"     },
  { key: "converting", label: "Converting to blocks" },
  { key: "done",       label: "Done"                 },
];

const ORDER: PipelineStep[] = ["refining", "generating", "converting", "done"];

function stepIndex(step: PipelineStep) {
  return ORDER.indexOf(step);
}

export default function PipelineStatus({
  step,
  errorMessage,
  onRetry,
}: PipelineStatusProps) {
  if (step === "idle") return null;

  const currentIndex = stepIndex(step === "error" ? "refining" : step);

  return (
    <div className="w-full rounded-md border-2 border-mc-stone-300 bg-mc-stone-100 p-4 font-mono text-sm">
      <ul className="flex flex-col gap-3">
        {STEPS.map(({ key, label }, i) => {
          const isActive    = step !== "error" && step === key;
          const isCompleted = step !== "error" && stepIndex(step) > i;
          const isError     = step === "error" && i === currentIndex;

          return (
            <li key={key} className="flex items-center gap-3">
              {/* Icon */}
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                {isActive && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-mc-grass-500 border-t-transparent rounded-full" />
                )}
                {isCompleted && (
                  <span className="text-mc-grass-700 text-base leading-none">✔</span>
                )}
                {isError && (
                  <span className="text-red-400 text-base leading-none">✖</span>
                )}
                {!isActive && !isCompleted && !isError && (
                  <span className="w-2 h-2 rounded-full bg-mc-stone opacity-40 mx-auto" />
                )}
              </span>

              {/* Label */}
              <span
                className={
                  isActive
                    ? "text-mc-grass-700"
                    : isCompleted
                    ? "text-mc-stone-900"
                    : isError
                    ? "text-red-400"
                    : "text-mc-stone-500 opacity-50"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Error block */}
      {step === "error" && (
        <div className="mt-4 flex flex-col gap-2">
          {errorMessage && (
            <p className="text-red-400 text-xs">{errorMessage}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="
                self-start px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide
                bg-red-500 text-white hover:bg-red-400 active:scale-95 transition-all
              "
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
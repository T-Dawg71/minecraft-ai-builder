"use client";

import React, { useEffect, useRef } from "react";

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  isLoading: boolean;
}

const MAX = 500;

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  onClear,
  isLoading,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter" && !isLoading && value.trim()) {
        onSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLoading, value, onSubmit]);

  const remaining = MAX - value.length;
  const overLimit = remaining < 0;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="
            w-full min-h-[140px] resize-y rounded-md p-3 pr-16
            bg-mc-stone-100 border-2 border-mc-stone-300 text-mc-stone-900
            placeholder:text-mc-stone-500
            focus:outline-none focus:border-mc-grass-500
            font-mono text-sm leading-relaxed
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="Describe your Minecraft creation..."
          value={value}
          maxLength={MAX}
          disabled={isLoading}
          onChange={(e) => onChange(e.target.value)}
        />
        {value.length > 0 && !isLoading && (
          <button
            onClick={onClear}
            aria-label="Clear input"
            className="
              absolute top-2 right-2 text-mc-stone-500 hover:text-mc-stone-900
              text-lg leading-none transition-colors
            "
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-mono">
        <span className={overLimit ? "text-red-400" : "text-mc-stone-500"}>
          {remaining < 100 ? `${remaining} characters left` : `${value.length} / ${MAX}`}
        </span>
        <span className="text-mc-stone-500 opacity-60">Ctrl + Enter to submit</span>
      </div>

      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim() || overLimit}
        className="
          mt-1 px-6 py-2 rounded-md font-bold font-mono text-sm uppercase tracking-wide
          bg-mc-grass-500 text-white
          hover:brightness-110 active:scale-95
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
          transition-all flex items-center justify-center gap-2
        "
      >
        {isLoading ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-mc-dark border-t-transparent rounded-full" />
            Generating...
          </>
        ) : (
          "Generate"
        )}
      </button>
    </div>
  );
}
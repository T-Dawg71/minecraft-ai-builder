"use client";

interface SkeletonBlockProps {
  className?: string;
}

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-mc-stone-200 ${className}`}
    />
  );
}

export default function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4 w-full font-mono">
      {/* Header row — mimics "64×64 BLOCKS" + zoom controls */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-28" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-7 w-16 rounded-full" />
          <SkeletonBlock className="h-7 w-24 rounded-full" />
        </div>
      </div>

      {/* Side-by-side image placeholders */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <SkeletonBlock className="h-3 w-16 mb-2" />
          <SkeletonBlock className="h-[400px] w-full rounded-md" />
        </div>
        <div>
          <SkeletonBlock className="h-3 w-12 mb-2" />
          <div className="h-[400px] w-full rounded-md bg-mc-stone-200 animate-pulse overflow-hidden relative">
            {/* Simulate a grid of block cells */}
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-0.5 p-0.5 opacity-30">
              {Array.from({ length: 64 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{
                    backgroundColor: `hsl(${(i * 37) % 360}, 20%, ${50 + (i % 5) * 5}%)`,
                    animationDelay: `${(i % 8) * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <SkeletonBlock className="h-14 rounded-md" />
        <SkeletonBlock className="h-14 rounded-md" />
        <SkeletonBlock className="h-14 rounded-md" />
      </div>
    </div>
  );
}
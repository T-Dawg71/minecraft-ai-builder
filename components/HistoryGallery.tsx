"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

interface HistoryEntry {
  id: string;
  user_prompt: string;
  refined_prompt: string;
  image_thumbnail: string;
  timestamp: string;
}

interface Props {
  onRemix: (prompt: string) => void;
}

function LazyHistoryImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full h-28 bg-stone-800">
      {visible ? (
        <Image
          src={`data:image/png;base64,${src}`}
          alt={alt}
          width={512}
          height={256}
          unoptimized
          loading="lazy"
          className="w-full h-28 object-cover"
        />
      ) : (
        <div className="w-full h-28 bg-stone-700 animate-pulse" />
      )}
    </div>
  );
}

export default function HistoryGallery({ onRemix }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const deleteEntry = async (id: string) => {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAll = async () => {
    await fetch("/api/history", { method: "DELETE" });
    setEntries([]);
  };

  if (loading) return <p className="text-sm text-stone-400">Loading history...</p>;
  if (entries.length === 0) return (
    <div className="border border-dashed border-stone-600 rounded-xl p-8 text-center text-sm text-stone-400">
      No generations yet. Run the pipeline to see history here.
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Generation history</h2>
        <button
          onClick={clearAll}
          className="text-sm text-red-500 border border-red-300 rounded-lg px-3 py-1 hover:bg-red-50"
        >
          Clear all
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-stone-800 border border-stone-700 rounded-xl overflow-hidden">
            {entry.image_thumbnail ? (
              <LazyHistoryImage src={entry.image_thumbnail} alt={entry.user_prompt} />
            ) : (
              <div className="w-full h-28 bg-stone-700 flex items-center justify-center text-xs text-stone-400">
                No image
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium truncate">{entry.user_prompt}</p>
              <p className="text-xs text-stone-400 mb-3">
                {new Date(entry.timestamp).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onRemix(entry.user_prompt)}
                  className="flex-1 text-xs border border-stone-600 rounded-lg py-1 hover:bg-stone-700"
                >
                  Remix ↗
                </button>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-xs border border-stone-600 rounded-lg px-2 py-1 text-red-400 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
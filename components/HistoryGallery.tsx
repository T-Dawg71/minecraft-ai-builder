"use client";
import { useEffect, useState, useCallback } from "react";

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

export default function HistoryGallery({ onRemix }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      console.log("History response:", data);
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

  if (loading) return <p className="text-sm text-gray-400">Loading history...</p>;
  if (entries.length === 0) return (
    <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-sm text-gray-400">
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
          <div key={entry.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {entry.image_thumbnail ? (
              <img
                src={`data:image/png;base64,${entry.image_thumbnail}`}
                alt={entry.user_prompt}
                className="w-full h-28 object-cover"
              />
            ) : (
              <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                No image
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium truncate">{entry.user_prompt}</p>
              <p className="text-xs text-gray-400 mb-3">
                {new Date(entry.timestamp).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onRemix(entry.user_prompt)}
                  className="flex-1 text-xs border border-gray-300 rounded-lg py-1 hover:bg-gray-50"
                >
                  Remix ↗
                </button>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-red-400 hover:bg-red-50"
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
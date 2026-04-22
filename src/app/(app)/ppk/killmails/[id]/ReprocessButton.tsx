"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReprocessButton({ kmId }: { kmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handle() {
    if (!confirm("Reprocess PPK calculation for this killmail? Previous balances will be reverted and recalculated.")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/killmails/${kmId}/reprocess`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const total = Number(data.totalDistributed);
        const fmt = total >= 1e9
          ? (total / 1e9).toFixed(2) + "B"
          : total >= 1e6
          ? (total / 1e6).toFixed(2) + "M"
          : total.toLocaleString();
        setResult(`✅ ${data.playersUpdated} players updated · ${fmt} ISK distributed`);
        router.refresh();
      } else {
        setResult("❌ " + (data.error ?? "Unknown error"));
      }
    } catch {
      setResult("❌ Network error");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handle}
        disabled={loading}
        className="bg-eve-accent hover:opacity-90 text-black text-xs font-semibold px-4 py-1.5 rounded disabled:opacity-50 transition-opacity"
      >
        {loading ? "Calculating..." : "⚡ Reprocess PPK"}
      </button>
      {result && <p className="text-xs text-eve-muted">{result}</p>}
    </div>
  );
}

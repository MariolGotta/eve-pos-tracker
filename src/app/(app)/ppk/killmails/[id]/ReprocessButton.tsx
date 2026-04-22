"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReprocessButton({ kmId }: { kmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handle() {
    if (!confirm("Reprocessar cálculo PPK desta killmail? Os saldos anteriores serão revertidos e recalculados.")) return;
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
        setResult(`✅ ${data.playersUpdated} jogadores atualizados · ${fmt} ISK distribuídos`);
        router.refresh();
      } else {
        setResult("❌ " + (data.error ?? "Erro desconhecido"));
      }
    } catch {
      setResult("❌ Erro de rede");
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
        {loading ? "Calculando..." : "⚡ Reprocessar PPK"}
      </button>
      {result && <p className="text-xs text-eve-muted">{result}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteKillmailButton({ kmId, kmStatus }: { kmId: string; kmStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle() {
    const warn =
      kmStatus === "COMPLETE"
        ? `⚠️ Esta killmail está COMPLETA — deletar irá REVERTER os saldos de todos os participantes.\n\nTem certeza que deseja deletar a killmail ${kmId}?`
        : `Deletar a killmail ${kmId}?`;
    if (!confirm(warn)) return;
    setLoading(true);
    const res = await fetch(`/api/killmails/${kmId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/ppk/killmails");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Erro ao deletar: " + (d.error ?? res.status));
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-xs px-4 py-1.5 border border-eve-red text-eve-red rounded hover:bg-eve-red/10 transition-colors disabled:opacity-50"
    >
      {loading ? "Deletando..." : "🗑 Deletar Killmail"}
    </button>
  );
}

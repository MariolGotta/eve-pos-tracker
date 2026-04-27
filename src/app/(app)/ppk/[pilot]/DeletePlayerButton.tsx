"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePlayerButton({ playerId, pilot }: { playerId: string; pilot: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (
      !confirm(
        `Delete player "${pilot}"?\n\nThis removes them from the ranking and erases their payment history. Kill records on killmails are kept.`
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/players/${playerId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/ppk");
      } else {
        const data = await res.json();
        alert("Error: " + (data.error ?? "Unknown error"));
        setLoading(false);
      }
    } catch {
      alert("Network error");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-300 text-xs font-semibold px-4 py-1.5 rounded disabled:opacity-50 transition-colors"
    >
      {loading ? "Deleting..." : "🗑 Delete Player"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RoleToggle({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // OWNER role is immutable
  if (currentRole === "OWNER") return null;

  const isAdmin = currentRole === "ADMIN";
  const nextRole = isAdmin ? "MEMBER" : "ADMIN";
  const label = isAdmin ? "Remover Admin" : "Tornar Admin";

  async function handle() {
    if (!confirm(`${label}?`)) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Erro: " + (d.error ?? res.status));
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-50 ${
        isAdmin
          ? "border-eve-red text-eve-red hover:bg-eve-red/10"
          : "border-eve-accent text-eve-accent hover:bg-eve-accent/10"
      }`}
    >
      {loading ? "..." : label}
    </button>
  );
}

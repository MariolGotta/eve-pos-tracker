"use client";
import { useState, useTransition } from "react";

interface Guild {
  guildId: string;
  name: string;
  addedAt: string;
}

export default function GuildsManager({ initialGuilds }: { initialGuilds: Guild[] }) {
  const [guilds, setGuilds] = useState(initialGuilds);
  const [guildId, setGuildId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function addGuild(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: guildId.trim(), name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add guild.");
        return;
      }
      const guild = await res.json();
      setGuilds((prev) => [...prev.filter((g) => g.guildId !== guild.guildId), guild]);
      setGuildId("");
      setName("");
    });
  }

  async function removeGuild(id: string) {
    if (!confirm("Remove this guild? Members will lose access.")) return;
    startTransition(async () => {
      await fetch(`/api/admin/guilds/${id}`, { method: "DELETE" });
      setGuilds((prev) => prev.filter((g) => g.guildId !== id));
    });
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form onSubmit={addGuild} className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Add Guild</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <label>Discord Server ID</label>
            <input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="e.g. 123456789012345678"
              required
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label>Friendly Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Alliance"
              required
              className="w-full"
            />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Adding…" : "Add Guild"}
          </button>
        </div>
      </form>

      {/* Guild list */}
      <div className="space-y-2">
        {guilds.length === 0 && (
          <p className="text-eve-muted text-sm">No guilds yet.</p>
        )}
        {guilds.map((g) => (
          <div key={g.guildId} className="card flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{g.name}</p>
              <p className="text-xs text-eve-muted font-mono">{g.guildId}</p>
              <p className="text-xs text-eve-muted">
                Added {new Date(g.addedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => removeGuild(g.guildId)}
              className="btn-danger text-xs"
              disabled={isPending}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

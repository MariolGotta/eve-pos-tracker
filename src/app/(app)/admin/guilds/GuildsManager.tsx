"use client";
import { useState, useTransition } from "react";

interface Guild {
  guildId: string;
  name: string;
  requiredRoleIds: string[];
  addedAt: string;
}

function RoleEditor({
  guild,
  onUpdate,
  disabled,
}: {
  guild: Guild;
  onUpdate: (updated: Guild) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [roleInput, setRoleInput] = useState("");
  const [roles, setRoles] = useState<string[]>(guild.requiredRoleIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addRole() {
    const trimmed = roleInput.trim();
    if (!trimmed || roles.includes(trimmed)) return;
    setRoles((prev) => [...prev, trimmed]);
    setRoleInput("");
  }

  function removeRole(role: string) {
    setRoles((prev) => prev.filter((r) => r !== role));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/guilds/${guild.guildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredRoleIds: roles }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      const updated = await res.json();
      onUpdate(updated);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-eve-accent underline"
        disabled={disabled}
      >
        {open ? "Cancel" : `Manage roles (${guild.requiredRoleIds.length})`}
      </button>

      {open && (
        <div className="mt-2 space-y-2 bg-eve-surface border border-eve-border rounded p-3">
          {roles.length === 0 ? (
            <p className="text-xs text-yellow-400">
              No roles configured — nobody can log in via this server.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <span
                  key={r}
                  className="flex items-center gap-1 text-xs bg-eve-bg rounded px-2 py-0.5 font-mono"
                >
                  {r}
                  <button
                    onClick={() => removeRole(r)}
                    className="text-red-400 hover:text-red-300 leading-none"
                    title="Remove role"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())}
              placeholder="Role ID (e.g. 123456789012345678)"
              className="flex-1 text-xs"
            />
            <button
              type="button"
              onClick={addRole}
              className="btn-secondary text-xs"
              disabled={!roleInput.trim()}
            >
              Add
            </button>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex justify-end">
            <button
              onClick={save}
              className="btn-primary text-xs"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save roles"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  function updateGuild(updated: Guild) {
    setGuilds((prev) => prev.map((g) => (g.guildId === updated.guildId ? updated : g)));
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form onSubmit={addGuild} className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Add Guild</h2>
        <p className="text-xs text-eve-muted">
          After adding a guild, configure at least one required role ID — guilds with no roles
          configured will block all logins.
        </p>
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
          <div key={g.guildId} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{g.name}</p>
                <p className="text-xs text-eve-muted font-mono">{g.guildId}</p>
                <p className="text-xs text-eve-muted">
                  Added {new Date(g.addedAt).toLocaleDateString()}
                </p>
                <RoleEditor guild={g} onUpdate={updateGuild} disabled={isPending} />
              </div>
              <button
                onClick={() => removeGuild(g.guildId)}
                className="btn-danger text-xs shrink-0"
                disabled={isPending}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatIsk(isk: string | null): string {
  if (!isk || isk === "0") return "—";
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export type AttackerRow = {
  id: string;
  pilot: string;
  corpTag: string;
  ship: string;
  damage: number;
  damagePct: number;
  iskEarned: string | null;
  finalBlow: boolean;
  topDamage: boolean;
};

export function KillmailAttackersClient({
  kmId,
  initialAttackers,
}: {
  kmId: string;
  initialAttackers: AttackerRow[];
}) {
  const router = useRouter();
  const [attackers, setAttackers] = useState<AttackerRow[]>(initialAttackers);
  const [editing, setEditing] = useState<AttackerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this attacker from the killmail?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/killmails/${kmId}/attackers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAttackers((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert("Error removing attacker: " + (data.error ?? res.status));
      }
    } catch {
      alert("Network error while removing attacker.");
    }
    setDeleting(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/killmails/${kmId}/attackers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilot: editing.pilot,
          corpTag: editing.corpTag,
          ship: editing.ship,
          damage: editing.damage,
          damagePct: editing.damagePct,
          finalBlow: editing.finalBlow,
          topDamage: editing.topDamage,
        }),
      });
      if (res.ok) {
        setAttackers((prev) => prev.map((a) => (a.id === editing.id ? editing : a)));
        setEditing(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert("Error saving: " + (data.error ?? res.status));
      }
    } catch {
      alert("Network error while saving.");
    }
    setSaving(false);
  }

  function field(key: keyof AttackerRow) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditing((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));
  }

  function numField(key: keyof AttackerRow) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditing((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev));
  }

  function boolField(key: keyof AttackerRow) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditing((prev) => (prev ? { ...prev, [key]: e.target.checked } : prev));
  }

  return (
    <>
      <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Pilot</th>
              <th className="text-left px-4 py-3">Corp</th>
              <th className="text-left px-4 py-3">Ship</th>
              <th className="text-right px-4 py-3">Damage</th>
              <th className="text-right px-4 py-3">Damage %</th>
              <th className="text-right px-4 py-3">ISK Earned</th>
              <th className="text-center px-4 py-3">Flags</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {attackers.map((a) => (
              <tr key={a.id} className="border-b border-eve-border hover:bg-eve-bg">
                <td className="px-4 py-2">
                  <Link
                    href={`/ppk/${encodeURIComponent(a.pilot)}`}
                    className="text-eve-accent hover:underline"
                  >
                    {a.pilot}
                  </Link>
                </td>
                <td className="px-4 py-2 text-eve-muted">[{a.corpTag}]</td>
                <td className="px-4 py-2 text-eve-muted text-xs">{a.ship}</td>
                <td className="px-4 py-2 text-right">{a.damage.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{a.damagePct.toFixed(1)}%</td>
                <td className={`px-4 py-2 text-right font-medium ${a.iskEarned && Number(a.iskEarned) > 0 ? "text-eve-gold" : "text-eve-muted"}`}>
                  {formatIsk(a.iskEarned)}
                </td>
                <td className="px-4 py-2 text-center text-xs space-x-1">
                  {a.finalBlow && <span className="text-eve-red">Final Blow</span>}
                  {a.topDamage && <span className="text-eve-accent">Top Damage</span>}
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setEditing({ ...a })}
                      className="text-eve-muted hover:text-eve-accent text-xs px-2 py-0.5 border border-eve-border rounded hover:border-eve-accent transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      className="text-eve-muted hover:text-eve-red text-xs px-2 py-0.5 border border-eve-border rounded hover:border-eve-red transition-colors disabled:opacity-50"
                    >
                      {deleting === a.id ? "..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="bg-eve-panel border border-eve-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-eve-muted">
              Edit Attacker
            </h3>

            {(
              [
                { label: "Pilot", key: "pilot" as const },
                { label: "Corp Tag", key: "corpTag" as const },
                { label: "Ship", key: "ship" as const },
              ] as const
            ).map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs text-eve-muted mb-1">{label}</label>
                <input
                  className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  value={editing[key] as string}
                  onChange={field(key)}
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-eve-muted mb-1">Damage</label>
                <input
                  type="number"
                  className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  value={editing.damage}
                  onChange={numField("damage")}
                />
              </div>
              <div>
                <label className="block text-xs text-eve-muted mb-1">Damage %</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  value={editing.damagePct}
                  onChange={numField("damagePct")}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.finalBlow}
                  onChange={boolField("finalBlow")}
                  className="accent-eve-red"
                />
                Final Blow
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.topDamage}
                  onChange={boolField("topDamage")}
                  className="accent-eve-accent"
                />
                Top Damage
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="text-eve-muted hover:text-white text-sm px-4 py-1.5 border border-eve-border rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-eve-accent text-black text-sm font-semibold px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

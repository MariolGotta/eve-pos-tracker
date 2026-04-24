"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type NewAttacker = {
  pilot: string;
  corpTag: string;
  ship: string;
  damagePct: string;
  finalBlow: boolean;
  topDamage: boolean;
};

interface EditKillmailModalProps {
  km: {
    id: string;
    iskValue: string;
    participantsTotal: number | null;
    victimPilot: string;
    victimCorpTag: string;
    victimShip: string;
    system: string;
    region: string | null;
    timestampUtc: string;
    shipType: string;
    status: string;
  };
  isAdmin: boolean;
}

const SHIP_TYPES = ["SUBCAP", "POS", "CAPITAL"];
const STATUSES = ["PENDING", "COMPLETE"];

const emptyAttacker = (): NewAttacker => ({
  pilot: "",
  corpTag: "",
  ship: "",
  damagePct: "",
  finalBlow: false,
  topDamage: false,
});

export function EditKillmailModal({ km, isAdmin }: EditKillmailModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Metadata form state (admin only)
  const [newId, setNewId] = useState(km.id);
  const [iskValue, setIskValue] = useState(km.iskValue);
  const [participantsTotal, setParticipantsTotal] = useState(km.participantsTotal?.toString() ?? "");
  const [victimPilot, setVictimPilot] = useState(km.victimPilot);
  const [victimCorpTag, setVictimCorpTag] = useState(km.victimCorpTag);
  const [victimShip, setVictimShip] = useState(km.victimShip);
  const [system, setSystem] = useState(km.system);
  const [region, setRegion] = useState(km.region ?? "");
  const [timestampUtc, setTimestampUtc] = useState(km.timestampUtc.slice(0, 16));
  const [shipType, setShipType] = useState(km.shipType);
  const [status, setStatus] = useState(km.status);

  // New attackers state (everyone)
  const [newAttackers, setNewAttackers] = useState<NewAttacker[]>([emptyAttacker()]);

  function addRow() {
    setNewAttackers((prev) => [...prev, emptyAttacker()]);
  }
  function removeRow(i: number) {
    setNewAttackers((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof NewAttacker, value: string | boolean) {
    setNewAttackers((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    try {
      let activeId = km.id;

      // 1. Save metadata (admin only)
      if (isAdmin) {
        const res = await fetch(`/api/killmails/${km.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newId: newId.trim() !== km.id ? newId.trim() : undefined,
            iskValue,
            participantsTotal: participantsTotal !== "" ? Number(participantsTotal) : null,
            victimPilot,
            victimCorpTag,
            victimShip,
            system,
            region: region || null,
            timestampUtc: new Date(timestampUtc + ":00Z").toISOString(),
            shipType,
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg({ ok: false, text: data.error ?? "Error saving." });
          setSaving(false);
          return;
        }
        if (data.id) activeId = data.id;
      }

      // 2. Add new attackers (everyone — only send rows with a pilot name)
      const validAttackers = newAttackers.filter((a) => a.pilot.trim());
      if (validAttackers.length > 0) {
        const res2 = await fetch(`/api/killmails/${activeId}/attackers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attackers: validAttackers.map((a) => ({
              pilot: a.pilot.trim(),
              corpTag: a.corpTag.trim().toUpperCase(),
              ship: a.ship.trim(),
              damagePct: Number(a.damagePct) || 0,
              damage: 0,
              finalBlow: a.finalBlow,
              topDamage: a.topDamage,
            })),
          }),
        });
        const data2 = await res2.json();
        if (!res2.ok) {
          setMsg({ ok: false, text: data2.error ?? "Error adding participants." });
          setSaving(false);
          return;
        }
      }

      setMsg({ ok: true, text: "Saved successfully." });
      setNewAttackers([emptyAttacker()]);
      router.refresh();
      if (activeId !== km.id) router.push(`/ppk/killmails/${activeId}`);
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-4 py-1.5 border border-eve-accent text-eve-accent rounded hover:bg-eve-accent/10 transition-colors"
      >
        {isAdmin ? "✏️ Edit Killmail" : "➕ Add Participants"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-eve-panel border border-eve-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-eve-border">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            {isAdmin ? "Edit Killmail" : "Add Participants"}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-eve-muted hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── ADMIN METADATA ────────────────────────────────────────────── */}
          {isAdmin && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Killmail ID</label>
                  <input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Ship Type</label>
                  <select
                    value={shipType}
                    onChange={(e) => setShipType(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  >
                    {SHIP_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-eve-muted mb-1">ISK Value</label>
                  <input
                    type="number"
                    value={iskValue}
                    onChange={(e) => setIskValue(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Total Participants</label>
                  <input
                    type="number"
                    value={participantsTotal}
                    onChange={(e) => setParticipantsTotal(e.target.value)}
                    placeholder="optional"
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                </div>
              </div>

              <div className="border border-eve-border rounded p-3 space-y-3">
                <p className="text-xs text-eve-muted uppercase tracking-wider font-semibold">Victim</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-eve-muted mb-1">Corp Tag</label>
                    <input
                      value={victimCorpTag}
                      onChange={(e) => setVictimCorpTag(e.target.value.toUpperCase())}
                      className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-eve-muted mb-1">Pilot</label>
                    <input
                      value={victimPilot}
                      onChange={(e) => setVictimPilot(e.target.value)}
                      className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Ship</label>
                  <input
                    value={victimShip}
                    onChange={(e) => setVictimShip(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-eve-muted mb-1">System</label>
                  <input
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Region (optional)</label>
                  <input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Date/Time (UTC)</label>
                  <input
                    type="datetime-local"
                    value={timestampUtc}
                    onChange={(e) => setTimestampUtc(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-eve-muted mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <hr className="border-eve-border" />
            </>
          )}

          {/* ── ADD PARTICIPANTS ───────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-eve-muted uppercase tracking-wider font-semibold">
                Add Participants
              </p>
              <button
                onClick={addRow}
                className="text-xs px-3 py-1 border border-eve-border text-eve-muted hover:text-white hover:border-eve-accent rounded transition-colors"
              >
                + Add row
              </button>
            </div>

            {/* Column headers */}
            <div className="grid gap-2 text-xs text-eve-muted uppercase tracking-wider px-1 mb-1"
              style={{ gridTemplateColumns: "2fr 1fr 2fr 1.2fr auto auto auto" }}>
              <span>Pilot *</span>
              <span>Corp</span>
              <span>Ship</span>
              <span>Dmg %</span>
              <span title="Final Blow">FB</span>
              <span title="Top Damage">TD</span>
              <span></span>
            </div>

            <div className="space-y-2">
              {newAttackers.map((row, i) => (
                <div
                  key={i}
                  className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "2fr 1fr 2fr 1.2fr auto auto auto" }}
                >
                  <input
                    value={row.pilot}
                    onChange={(e) => updateRow(i, "pilot", e.target.value)}
                    placeholder="Pilot name"
                    className="bg-eve-bg border border-eve-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-eve-accent"
                  />
                  <input
                    value={row.corpTag}
                    onChange={(e) => updateRow(i, "corpTag", e.target.value.toUpperCase())}
                    placeholder="TAG"
                    maxLength={6}
                    className="bg-eve-bg border border-eve-border rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                  <input
                    value={row.ship}
                    onChange={(e) => updateRow(i, "ship", e.target.value)}
                    placeholder="Ship name"
                    className="bg-eve-bg border border-eve-border rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-eve-accent"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={row.damagePct}
                    onChange={(e) => updateRow(i, "damagePct", e.target.value)}
                    placeholder="0.0"
                    className="bg-eve-bg border border-eve-border rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-eve-accent"
                  />
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      title="Final Blow"
                      checked={row.finalBlow}
                      onChange={(e) => updateRow(i, "finalBlow", e.target.checked)}
                      className="accent-eve-accent w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      title="Top Damage"
                      checked={row.topDamage}
                      onChange={(e) => updateRow(i, "topDamage", e.target.checked)}
                      className="accent-eve-accent w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => removeRow(i)}
                    disabled={newAttackers.length === 1}
                    title="Remove row"
                    className="text-eve-muted hover:text-red-400 disabled:opacity-20 text-sm px-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-eve-muted mt-2">
              FB = Final Blow &nbsp;·&nbsp; TD = Top Damage &nbsp;·&nbsp; Rows with empty Pilot will be skipped.
            </p>
          </div>

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-eve-green" : "text-eve-red"}`}>{msg.text}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-eve-accent hover:opacity-90 text-black text-sm font-semibold py-2 rounded disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-5 border border-eve-border text-eve-muted hover:text-white rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

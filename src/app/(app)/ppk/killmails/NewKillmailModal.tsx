"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SystemAutocomplete from "@/components/SystemAutocomplete";
import REGIONS_RAW from "@/lib/eve-systems-regions.json";

const REGIONS = REGIONS_RAW as Record<string, string>;

type AttackerRow = {
  pilot: string;
  corpTag: string;
  ship: string;
  damagePct: string;
  finalBlow: boolean;
  topDamage: boolean;
};

const SHIP_TYPES = ["SUBCAP", "POS", "CAPITAL"];

const emptyAttacker = (): AttackerRow => ({
  pilot: "",
  corpTag: "",
  ship: "",
  damagePct: "",
  finalBlow: false,
  topDamage: false,
});

function nowUtcLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewKillmailModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Killmail fields
  const [killmailId, setKillmailId] = useState("");
  const [iskValue, setIskValue] = useState("");
  const [shipType, setShipType] = useState("SUBCAP");
  const [participantsTotal, setParticipantsTotal] = useState("");
  const [victimPilot, setVictimPilot] = useState("");
  const [victimCorpTag, setVictimCorpTag] = useState("");
  const [victimShip, setVictimShip] = useState("");
  const [system, setSystem] = useState("");
  const [region, setRegion] = useState("");
  const [timestampUtc, setTimestampUtc] = useState(nowUtcLocal);

  // Attackers
  const [attackers, setAttackers] = useState<AttackerRow[]>([emptyAttacker()]);

  function addRow() { setAttackers((p) => [...p, emptyAttacker()]); }
  function removeRow(i: number) { setAttackers((p) => p.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: keyof AttackerRow, value: string | boolean) {
    setAttackers((p) => p.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function reset() {
    setKillmailId(""); setIskValue(""); setShipType("SUBCAP");
    setParticipantsTotal(""); setVictimPilot(""); setVictimCorpTag("");
    setVictimShip(""); setSystem(""); setRegion("");
    setTimestampUtc(nowUtcLocal()); setAttackers([emptyAttacker()]); setMsg(null);
  }

  async function handleSave() {
    if (!killmailId.trim()) { setMsg({ ok: false, text: "Killmail ID is required." }); return; }
    if (!iskValue) { setMsg({ ok: false, text: "ISK Value is required." }); return; }
    if (!victimPilot.trim()) { setMsg({ ok: false, text: "Victim pilot is required." }); return; }
    if (!system.trim()) { setMsg({ ok: false, text: "System is required." }); return; }

    setSaving(true);
    setMsg(null);

    const validAttackers = attackers.filter((a) => a.pilot.trim());

    try {
      const res = await fetch("/api/killmails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          killmail_id: killmailId.trim(),
          report_title: "Manual Entry",
          timestamp_utc: new Date(timestampUtc + ":00Z").toISOString(),
          system: system.trim(),
          region: region.trim() || null,
          total_damage: 0,
          isk_value: iskValue,
          ship_type: shipType,
          victim: {
            pilot: victimPilot.trim(),
            corp_tag: victimCorpTag.trim().toUpperCase(),
            ship: victimShip.trim(),
          },
          attackers: validAttackers.map((a) => ({
            pilot: a.pilot.trim(),
            corp_tag: a.corpTag.trim().toUpperCase(),
            ship: a.ship.trim(),
            damage: 0,
            damage_pct: Number(a.damagePct) || 0,
            final_blow: a.finalBlow,
            top_damage: a.topDamage,
          })),
          participants_count_total: participantsTotal !== "" ? Number(participantsTotal) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Error creating killmail." });
        setSaving(false);
        return;
      }

      setOpen(false);
      reset();
      router.push(`/ppk/killmails/${data.killmailId ?? killmailId.trim()}`);
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-4 py-1.5 bg-eve-accent hover:opacity-90 text-black font-semibold rounded transition-opacity"
      >
        + New Killmail
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-eve-panel border border-eve-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-eve-border">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">New Killmail</h2>
          <button onClick={() => { setOpen(false); reset(); }} className="text-eve-muted hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Row 1: ID + Ship Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-eve-muted mb-1">Killmail ID *</label>
              <input
                value={killmailId}
                onChange={(e) => setKillmailId(e.target.value)}
                placeholder="e.g. 11920642"
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

          {/* Row 2: ISK + Participants */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-eve-muted mb-1">ISK Value *</label>
              <input
                type="number"
                value={iskValue}
                onChange={(e) => setIskValue(e.target.value)}
                placeholder="e.g. 2212370783"
                className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-eve-muted mb-1">Total Participants (optional)</label>
              <input
                type="number"
                value={participantsTotal}
                onChange={(e) => setParticipantsTotal(e.target.value)}
                placeholder="optional"
                className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
              />
            </div>
          </div>

          {/* Victim */}
          <div className="border border-eve-border rounded p-3 space-y-3">
            <p className="text-xs text-eve-muted uppercase tracking-wider font-semibold">Victim</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-eve-muted mb-1">Corp Tag</label>
                <input
                  value={victimCorpTag}
                  onChange={(e) => setVictimCorpTag(e.target.value.toUpperCase())}
                  placeholder="CORP"
                  maxLength={6}
                  className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-eve-muted mb-1">Pilot *</label>
                <input
                  value={victimPilot}
                  onChange={(e) => setVictimPilot(e.target.value)}
                  placeholder="Pilot name"
                  className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-eve-muted mb-1">Ship</label>
              <input
                value={victimShip}
                onChange={(e) => setVictimShip(e.target.value)}
                placeholder="Ship name"
                className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
              />
            </div>
          </div>

          {/* Location + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-eve-muted mb-1">System *</label>
              <SystemAutocomplete
                value={system}
                onChange={(val) => {
                  setSystem(val);
                  const found = REGIONS[val];
                  if (found) setRegion(found);
                }}
                placeholder="e.g. RTX0-S"
                inputClassName="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-eve-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-eve-muted mb-1">Region (auto-filled)</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Outer Ring"
                className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-eve-muted mb-1">Date / Time (UTC)</label>
            <input
              type="datetime-local"
              value={timestampUtc}
              onChange={(e) => setTimestampUtc(e.target.value)}
              className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
            />
          </div>

          <hr className="border-eve-border" />

          {/* Attackers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-eve-muted uppercase tracking-wider font-semibold">Participants</p>
              <button
                onClick={addRow}
                className="text-xs px-3 py-1 border border-eve-border text-eve-muted hover:text-white hover:border-eve-accent rounded transition-colors"
              >
                + Add row
              </button>
            </div>

            <div className="grid gap-2 text-xs text-eve-muted uppercase tracking-wider px-1 mb-1"
              style={{ gridTemplateColumns: "2fr 1fr 2fr 1.2fr auto auto auto" }}>
              <span>Pilot</span>
              <span>Corp</span>
              <span>Ship</span>
              <span>Dmg %</span>
              <span title="Final Blow">FB</span>
              <span title="Top Damage">TD</span>
              <span></span>
            </div>

            <div className="space-y-2">
              {attackers.map((row, i) => (
                <div key={i} className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "2fr 1fr 2fr 1.2fr auto auto auto" }}>
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
                    <input type="checkbox" title="Final Blow" checked={row.finalBlow}
                      onChange={(e) => updateRow(i, "finalBlow", e.target.checked)}
                      className="accent-eve-accent w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-center">
                    <input type="checkbox" title="Top Damage" checked={row.topDamage}
                      onChange={(e) => updateRow(i, "topDamage", e.target.checked)}
                      className="accent-eve-accent w-4 h-4 cursor-pointer" />
                  </div>
                  <button onClick={() => removeRow(i)} disabled={attackers.length === 1}
                    title="Remove row"
                    className="text-eve-muted hover:text-red-400 disabled:opacity-20 text-sm px-1 transition-colors">
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
              {saving ? "Creating..." : "Create Killmail"}
            </button>
            <button
              onClick={() => { setOpen(false); reset(); }}
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

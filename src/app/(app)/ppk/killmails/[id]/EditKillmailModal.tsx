"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
}

const SHIP_TYPES = ["SUBCAP", "POS", "CAPITAL"];
const STATUSES = ["PENDING", "COMPLETE"];

export function EditKillmailModal({ km }: EditKillmailModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Form state
  const [newId, setNewId] = useState(km.id);
  const [iskValue, setIskValue] = useState(km.iskValue);
  const [participantsTotal, setParticipantsTotal] = useState(km.participantsTotal?.toString() ?? "");
  const [victimPilot, setVictimPilot] = useState(km.victimPilot);
  const [victimCorpTag, setVictimCorpTag] = useState(km.victimCorpTag);
  const [victimShip, setVictimShip] = useState(km.victimShip);
  const [system, setSystem] = useState(km.system);
  const [region, setRegion] = useState(km.region ?? "");
  const [timestampUtc, setTimestampUtc] = useState(
    km.timestampUtc.slice(0, 16) // "YYYY-MM-DDTHH:MM"
  );
  const [shipType, setShipType] = useState(km.shipType);
  const [status, setStatus] = useState(km.status);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
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
      if (res.ok) {
        setMsg({ ok: true, text: "Killmail updated successfully." });
        router.refresh();
        // If ID changed, navigate to new URL
        if (data.id && data.id !== km.id) {
          router.push(`/ppk/killmails/${data.id}`);
        }
      } else {
        setMsg({ ok: false, text: data.error ?? "Error saving." });
      }
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
        ✏️ Edit Killmail
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-eve-panel border border-eve-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-eve-border">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Edit Killmail</h2>
          <button onClick={() => setOpen(false)} className="text-eve-muted hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Row: ID + Ship Type */}
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

          {/* Row: ISK Value + Participants */}
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

          {/* Victim */}
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

          {/* Location + Date */}
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

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-eve-green" : "text-eve-red"}`}>{msg.text}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-eve-accent hover:opacity-90 text-black text-sm font-semibold py-2 rounded disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Changes"}
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

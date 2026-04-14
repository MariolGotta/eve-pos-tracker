"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SystemAutocomplete from "@/components/SystemAutocomplete";

interface ActiveTimer {
  id: string;
  expiresAt: string; // ISO string
  kind: string; // SHIELD_TO_ARMOR | ARMOR_TO_HULL
}

interface Structure {
  id: string;
  system: string;
  kind: "POS" | "CITADEL";
  name: string | null;
  corporation: string | null;
  distanceFromSun: number;
  notes: string | null;
  activeTimer?: ActiveTimer | null;
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────
// Convert ms remaining into d/h/m parts (clamped to 0)
function msToparts(ms: number) {
  const total = Math.max(0, ms);
  const d = Math.floor(total / 86_400_000);
  const h = Math.floor((total % 86_400_000) / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  return { d, h, m };
}

function EditDialog({
  structure,
  onClose,
  onSaved,
}: {
  structure: Structure;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [system, setSystem] = useState(structure.system);
  const [kind, setKind] = useState<"POS" | "CITADEL">(structure.kind);
  const [name, setName] = useState(structure.name ?? "");
  const [corporation, setCorporation] = useState(structure.corporation ?? "");
  const [distance, setDistance] = useState(String(structure.distanceFromSun));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Timer duration state — pre-populate from current expiresAt
  const initialRemaining = structure.activeTimer
    ? new Date(structure.activeTimer.expiresAt).getTime() - Date.now()
    : 0;
  const initialParts = msToparts(initialRemaining);
  const [timerD, setTimerD] = useState(initialParts.d);
  const [timerH, setTimerH] = useState(initialParts.h);
  const [timerM, setTimerM] = useState(initialParts.m);
  const timerMs = timerD * 86_400_000 + timerH * 3_600_000 + timerM * 60_000;

  const isHull = structure.activeTimer?.kind === "ARMOR_TO_HULL";

  function save() {
    if (!system.trim()) { setError("System is required."); return; }
    if (structure.activeTimer && timerMs <= 0) {
      setError("Timer must be in the future."); return;
    }
    setError("");
    startTransition(async () => {
      const timerExpiresAt = structure.activeTimer
        ? new Date(Date.now() + timerMs).toISOString()
        : undefined;

      const res = await fetch(`/api/structures/${structure.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: system.trim(),
          kind,
          name: name.trim() || null,
          corporation: corporation.trim() || null,
          distanceFromSun: parseFloat(distance) || 0,
          ...(timerExpiresAt ? { timerExpiresAt } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="card w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">Edit Structure</h2>

        <div>
          <label>Solar System *</label>
          <SystemAutocomplete value={system} onChange={setSystem} required />
        </div>

        <div>
          <label>Structure Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as "POS" | "CITADEL")} className="w-full">
            <option value="POS">POS (Player-Owned Starbase)</option>
            <option value="CITADEL">Citadel / Upwell Structure</option>
          </select>
        </div>

        <div>
          <label>Distance from Sun (AU)</label>
          <input type="number" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full" />
        </div>

        <div>
          <label>Structure Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" className="w-full" />
        </div>

        <div>
          <label>Corporation</label>
          <input value={corporation} onChange={(e) => setCorporation(e.target.value)} placeholder="optional" className="w-full" />
        </div>

        {/* Active timer duration editor */}
        {structure.activeTimer && (
          <div className={`space-y-2 p-3 rounded-md border ${isHull ? "bg-red-500/5 border-red-500/30" : "bg-yellow-500/5 border-yellow-500/30"}`}>
            <label className={isHull ? "text-red-300" : "text-yellow-300"}>
              Time remaining until {isHull ? "hull" : "armor"} window *
            </label>
            <div className="flex items-center gap-2">
              {isHull && (
                <>
                  <div className="flex-1">
                    <input type="number" min={0} max={8} value={timerD}
                      onChange={(e) => setTimerD(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)))}
                      className="w-full text-center" />
                    <p className="text-xs text-eve-muted text-center mt-0.5">days</p>
                  </div>
                  <span className="text-xl font-bold text-eve-muted pb-4">:</span>
                </>
              )}
              <div className="flex-1">
                <input type="number" min={0} max={isHull ? 23 : 47} value={timerH}
                  onChange={(e) => setTimerH(Math.max(0, Math.min(isHull ? 23 : 47, parseInt(e.target.value) || 0)))}
                  className="w-full text-center" />
                <p className="text-xs text-eve-muted text-center mt-0.5">hours</p>
              </div>
              <span className="text-xl font-bold text-eve-muted pb-4">:</span>
              <div className="flex-1">
                <input type="number" min={0} max={59} value={timerM}
                  onChange={(e) => setTimerM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full text-center" />
                <p className="text-xs text-eve-muted text-center mt-0.5">minutes</p>
              </div>
            </div>
            {timerMs > 0 && (
              <p className="text-xs text-eve-muted">
                New expiry: <span className="text-gray-300">{new Date(Date.now() + timerMs).toUTCString()}</span>
              </p>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost" disabled={isPending}>Cancel</button>
          <button onClick={save} className="btn-primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notes Box ─────────────────────────────────────────────────────────────────
function NotesBox({ structureId, initial }: { structureId: string; initial: string | null }) {
  const [notes, setNotes] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const MAX = 100;

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/structures/${structureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-eve-muted uppercase tracking-wide">Notes</p>
        <span className={`text-xs ${notes.length > MAX ? "text-red-400" : "text-eve-muted"}`}>
          {notes.length}/{MAX}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder="Add a note visible to everyone…"
        className="w-full resize-none text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-green-400">Saved</span>}
        <button
          onClick={save}
          disabled={isPending || notes.length > MAX}
          className="btn-primary text-xs"
        >
          {isPending ? "Saving…" : "Save Notes"}
        </button>
      </div>
    </div>
  );
}

// ── Delete Button (owner only) ────────────────────────────────────────────────
function DeleteButton({ structureId }: { structureId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this structure? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/structures/${structureId}`, { method: "DELETE" });
      if (res.ok) router.push("/structures");
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="btn-danger text-xs">
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}

// ── Exported composite component ──────────────────────────────────────────────
export default function StructureControls({
  structure,
  isOwner,
}: {
  structure: Structure;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      {/* Edit + Delete buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setEditOpen(true)} className="btn-secondary text-xs">
          Edit
        </button>
        {isOwner && <DeleteButton structureId={structure.id} />}
      </div>

      {/* Notes box */}
      <NotesBox structureId={structure.id} initial={structure.notes} />

      {/* Edit dialog */}
      {editOpen && (
        <EditDialog
          structure={structure}
          onClose={() => setEditOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

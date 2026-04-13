"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Structure {
  id: string;
  system: string;
  kind: "POS" | "CITADEL";
  name: string | null;
  corporation: string | null;
  distanceFromSun: number;
  notes: string | null;
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────
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

  function save() {
    if (!system.trim()) { setError("System is required."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/structures/${structure.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: system.trim(),
          kind,
          name: name.trim() || null,
          corporation: corporation.trim() || null,
          distanceFromSun: parseFloat(distance) || 0,
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
      <div className="card w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold text-white">Edit Structure</h2>

        <div>
          <label>Solar System *</label>
          <input value={system} onChange={(e) => setSystem(e.target.value)} className="w-full" />
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

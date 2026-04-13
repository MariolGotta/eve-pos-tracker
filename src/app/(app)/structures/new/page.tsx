"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const INITIAL_STATES = [
  { value: "SHIELD", label: "Shield (full shields)" },
  { value: "ARMOR_TIMER", label: "Armor Timer (waiting for armor window)" },
  { value: "ARMOR_VULNERABLE", label: "Armor Vulnerable (armor window open)" },
  { value: "HULL_TIMER", label: "Hull Timer (waiting for hull window)" },
  { value: "HULL_VULNERABLE", label: "Hull Vulnerable (hull window open)" },
];

export default function NewStructurePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [initialState, setInitialState] = useState("SHIELD");

  // Armor timer: hours + minutes
  const [armorH, setArmorH] = useState(23);
  const [armorM, setArmorM] = useState(55);

  // Hull timer: days + hours + minutes
  const [hullD, setHullD] = useState(1);
  const [hullH, setHullH] = useState(0);
  const [hullM, setHullM] = useState(0);

  const armorMs = armorH * 3_600_000 + armorM * 60_000;
  const hullMs = hullD * 86_400_000 + hullH * 3_600_000 + hullM * 60_000;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);

    if (initialState === "ARMOR_TIMER" && armorMs <= 0) {
      setError("Please enter the remaining time until the armor window.");
      return;
    }
    if (initialState === "HULL_TIMER" && hullMs <= 0) {
      setError("Please enter the remaining time until the hull window.");
      return;
    }

    const timerExpiresAt =
      initialState === "ARMOR_TIMER"
        ? new Date(Date.now() + armorMs).toISOString()
        : initialState === "HULL_TIMER"
        ? new Date(Date.now() + hullMs).toISOString()
        : null;

    startTransition(async () => {
      const res = await fetch("/api/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: form.get("system"),
          distanceFromSun: form.get("distanceFromSun"),
          kind: form.get("kind") || "POS",
          name: form.get("name") || null,
          corporation: form.get("corporation") || null,
          notes: form.get("notes") || null,
          initialState,
          timerExpiresAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create structure.");
        return;
      }

      const structure = await res.json();
      router.push(`/structures/${structure.id}`);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-white">New Structure</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="system">Solar System *</label>
          <input id="system" name="system" required placeholder="e.g. Jita" className="w-full" />
        </div>

        <div>
          <label htmlFor="distanceFromSun">Distance from Sun (AU) *</label>
          <input
            id="distanceFromSun"
            name="distanceFromSun"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 7.93"
            className="w-full"
          />
        </div>

        <div>
          <label htmlFor="kind">Structure Type *</label>
          <select id="kind" name="kind" className="w-full" defaultValue="POS">
            <option value="POS">POS (Player-Owned Starbase)</option>
            <option value="CITADEL">Citadel / Upwell Structure</option>
          </select>
        </div>

        <div>
          <label htmlFor="initialState">Current State *</label>
          <select
            id="initialState"
            name="initialState"
            className="w-full"
            value={initialState}
            onChange={(e) => setInitialState(e.target.value)}
          >
            {INITIAL_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Armor timer remaining time */}
        {initialState === "ARMOR_TIMER" && (
          <div className="space-y-2 p-3 bg-yellow-500/5 border border-yellow-500/30 rounded-md">
            <label className="text-yellow-300">Time remaining until armor window opens *</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number" min={0} max={47} value={armorH}
                  onChange={(e) => setArmorH(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center"
                />
                <p className="text-xs text-eve-muted text-center mt-0.5">hours</p>
              </div>
              <span className="text-2xl font-bold text-eve-muted pb-4">:</span>
              <div className="flex-1">
                <input
                  type="number" min={0} max={59} value={armorM}
                  onChange={(e) => setArmorM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full text-center"
                />
                <p className="text-xs text-eve-muted text-center mt-0.5">minutes</p>
              </div>
            </div>
            {armorMs > 0 && (
              <p className="text-xs text-eve-muted">
                Window opens at:{" "}
                <span className="text-gray-300">
                  {new Date(Date.now() + armorMs).toUTCString()}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Hull timer remaining time */}
        {initialState === "HULL_TIMER" && (
          <div className="space-y-2 p-3 bg-red-500/5 border border-red-500/30 rounded-md">
            <label className="text-red-300">Time remaining until hull window opens *</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number" min={0} max={8} value={hullD}
                  onChange={(e) => setHullD(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)))}
                  className="w-full text-center"
                />
                <p className="text-xs text-eve-muted text-center mt-0.5">days</p>
              </div>
              <span className="text-xl font-bold text-eve-muted pb-4">:</span>
              <div className="flex-1">
                <input
                  type="number" min={0} max={23} value={hullH}
                  onChange={(e) => setHullH(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  className="w-full text-center"
                />
                <p className="text-xs text-eve-muted text-center mt-0.5">hours</p>
              </div>
              <span className="text-xl font-bold text-eve-muted pb-4">:</span>
              <div className="flex-1">
                <input
                  type="number" min={0} max={59} value={hullM}
                  onChange={(e) => setHullM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full text-center"
                />
                <p className="text-xs text-eve-muted text-center mt-0.5">minutes</p>
              </div>
            </div>
            {hullMs > 0 && (
              <p className="text-xs text-eve-muted">
                Window opens at:{" "}
                <span className="text-gray-300">
                  {new Date(Date.now() + hullMs).toUTCString()}
                </span>
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="name">Structure Name (optional)</label>
          <input id="name" name="name" placeholder="e.g. IV-4 Control Tower" className="w-full" />
        </div>

        <div>
          <label htmlFor="corporation">Corporation (optional)</label>
          <input id="corporation" name="corporation" placeholder="e.g. [ZCT] Some Corp" className="w-full" />
        </div>

        <div>
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Any additional notes…"
            className="w-full resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <a href="/structures" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

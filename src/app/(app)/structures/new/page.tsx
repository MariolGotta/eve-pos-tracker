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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await fetch("/api/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: form.get("system"),
          distanceFromSun: form.get("distanceFromSun"),
          name: form.get("name") || null,
          corporation: form.get("corporation") || null,
          notes: form.get("notes") || null,
          initialState: form.get("initialState") || "SHIELD",
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
      <h1 className="text-xl font-bold text-white">New POS</h1>

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
          <label htmlFor="initialState">Current State *</label>
          <select id="initialState" name="initialState" className="w-full" defaultValue="SHIELD">
            {INITIAL_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="name">POS Name (optional)</label>
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
          <a href="/structures" className="btn-ghost">
            Cancel
          </a>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Creating…" : "Create POS"}
          </button>
        </div>
      </form>
    </div>
  );
}

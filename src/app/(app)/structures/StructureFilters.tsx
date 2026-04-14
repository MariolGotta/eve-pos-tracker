"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SystemAutocomplete from "@/components/SystemAutocomplete";

const ALL_STATES = [
  "SHIELD",
  "ARMOR_TIMER",
  "ARMOR_VULNERABLE",
  "HULL_TIMER",
  "HULL_VULNERABLE",
  "DEAD",
];

interface Props {
  defaults: {
    system?: string;
    corp?: string;
    kind?: string;
    state?: string;
    dead?: string;
  };
}

export default function StructureFilters({ defaults }: Props) {
  const router = useRouter();
  const [system, setSystem] = useState(defaults.system ?? "");
  const [corp, setCorp] = useState(defaults.corp ?? "");
  const [kind, setKind] = useState(defaults.kind ?? "");
  const [state, setState] = useState(defaults.state ?? "");
  const [dead, setDead] = useState(defaults.dead === "1");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (system.trim()) params.set("system", system.trim());
    if (corp.trim()) params.set("corp", corp.trim());
    if (kind) params.set("kind", kind);
    if (state) params.set("state", state);
    if (dead) params.set("dead", "1");
    router.push(`/structures?${params.toString()}`);
  }

  function clear() {
    setSystem("");
    setCorp("");
    setKind("");
    setState("");
    setDead(false);
    router.push("/structures");
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap gap-3">
      <SystemAutocomplete
        value={system}
        onChange={setSystem}
        placeholder="Filter by system…"
        className="w-48"
      />
      <input
        value={corp}
        onChange={(e) => setCorp(e.target.value)}
        placeholder="Filter by corporation…"
        className="w-48"
      />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-36">
        <option value="">All types</option>
        <option value="POS">POS</option>
        <option value="CITADEL">Citadel</option>
      </select>
      <select value={state} onChange={(e) => setState(e.target.value)} className="w-44">
        <option value="">All states</option>
        {ALL_STATES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={dead}
          onChange={(e) => setDead(e.target.checked)}
          className="w-auto border-0 p-0"
        />
        Include dead
      </label>
      <button type="submit" className="btn-primary text-sm">Filter</button>
      <button type="button" onClick={clear} className="btn-ghost text-sm">Clear</button>
    </form>
  );
}

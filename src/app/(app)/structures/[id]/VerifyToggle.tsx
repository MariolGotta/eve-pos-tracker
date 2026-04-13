"use client";
import { useState, useTransition } from "react";

export default function VerifyToggle({
  structureId,
  initial,
}: {
  structureId: string;
  initial: boolean;
}) {
  const [needs, setNeeds] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/structures/${structureId}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setNeeds(data.needsVerification);
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`text-xs px-3 py-1.5 rounded border font-semibold transition-colors ${
        needs
          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30"
          : "bg-eve-surface text-eve-muted border-eve-border hover:text-white hover:border-eve-accent/50"
      }`}
    >
      {isPending ? "…" : needs ? "Needs Verification" : "Mark for Verification"}
    </button>
  );
}

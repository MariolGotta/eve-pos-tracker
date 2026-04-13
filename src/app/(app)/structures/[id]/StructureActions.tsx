"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TransitionDialog from "@/components/TransitionDialog";
import { TransitionAction } from "@/lib/state-machine";
import { StructureState } from "@prisma/client";

interface Props {
  structureId: string;
  currentState: StructureState;
  actions: TransitionAction[];
  vulnerableWindowEnd: string | null;
}

export default function StructureActions({
  structureId,
  currentState,
  actions,
  vulnerableWindowEnd,
}: Props) {
  const router = useRouter();
  const [autoOpen, setAutoOpen] = useState(false);

  const isVulnerable =
    currentState === "ARMOR_VULNERABLE" || currentState === "HULL_VULNERABLE";

  useEffect(() => {
    if (!isVulnerable || !vulnerableWindowEnd) return;

    const end = new Date(vulnerableWindowEnd).getTime();
    const remaining = end - Date.now();

    if (remaining <= 0) {
      // Window already expired — open dialog immediately
      setAutoOpen(true);
      return;
    }

    // Schedule auto-open when window closes
    const timeout = setTimeout(() => setAutoOpen(true), remaining);
    return () => clearTimeout(timeout);
  }, [isVulnerable, vulnerableWindowEnd]);

  return (
    <TransitionDialog
      structureId={structureId}
      currentState={currentState}
      actions={actions}
      autoOpen={autoOpen}
      onSuccess={() => router.refresh()}
      onClose={() => setAutoOpen(false)}
    />
  );
}

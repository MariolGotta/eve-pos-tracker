"use client";
import { useRouter } from "next/navigation";
import TransitionDialog from "@/components/TransitionDialog";
import { TransitionAction } from "@/lib/state-machine";
import { StructureState } from "@prisma/client";

interface Props {
  structureId: string;
  currentState: StructureState;
  actions: TransitionAction[];
}

export default function StructureActions({ structureId, currentState, actions }: Props) {
  const router = useRouter();

  return (
    <TransitionDialog
      structureId={structureId}
      currentState={currentState}
      actions={actions}
      onSuccess={() => router.refresh()}
    />
  );
}

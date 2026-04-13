import { StructureState } from "@prisma/client";
import { stateLabel } from "@/lib/state-machine";

const STATE_STYLES: Record<StructureState, string> = {
  SHIELD: "bg-blue-900/50 text-blue-300 border-blue-700",
  ARMOR_TIMER: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  ARMOR_VULNERABLE: "bg-red-900/50 text-red-300 border-red-700 animate-pulse",
  HULL_TIMER: "bg-orange-900/50 text-orange-300 border-orange-700",
  HULL_VULNERABLE: "bg-red-900/60 text-red-200 border-red-600 animate-pulse",
  DEAD: "bg-gray-800 text-gray-500 border-gray-700",
};

interface Props {
  state: StructureState;
  className?: string;
}

export default function StateBadge({ state, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold uppercase tracking-wide ${STATE_STYLES[state]} ${className}`}
    >
      {stateLabel(state)}
    </span>
  );
}

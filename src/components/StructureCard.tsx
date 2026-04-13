import Link from "next/link";
import { StructureState } from "@prisma/client";
import StateBadge from "./StateBadge";
import TimerCountdown from "./TimerCountdown";

interface Timer {
  id: string;
  expiresAt: string;
  kind: string;
}

interface Props {
  id: string;
  system: string;
  distanceFromSun: number;
  name: string | null;
  corporation: string | null;
  currentState: StructureState;
  activeTimer?: Timer | null;
}

export default function StructureCard({
  id,
  system,
  distanceFromSun,
  name,
  corporation,
  currentState,
  activeTimer,
}: Props) {
  return (
    <Link href={`/structures/${id}`} className="card block hover:border-eve-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{system}</span>
            <span className="text-eve-muted text-xs">{distanceFromSun} AU</span>
          </div>
          <div className="text-xs text-eve-muted mt-0.5 space-x-2">
            {name && <span>{name}</span>}
            {corporation && <span className="text-eve-gold">{corporation}</span>}
          </div>
        </div>
        <StateBadge state={currentState} />
      </div>

      {activeTimer && (
        <div className="mt-3 flex items-center gap-2 text-xs text-eve-muted border-t border-eve-border pt-2">
          <span>
            {activeTimer.kind === "SHIELD_TO_ARMOR"
              ? "Armor starts"
              : "Hull starts"}
            :
          </span>
          <TimerCountdown expiresAt={activeTimer.expiresAt} />
        </div>
      )}
    </Link>
  );
}

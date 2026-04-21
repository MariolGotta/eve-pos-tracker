import Link from "next/link";
import { StructureKind, StructureState } from "@prisma/client";
import StateBadge from "./StateBadge";
import TimerCountdown from "./TimerCountdown";
import LocalTime from "./LocalTime";
import REGIONS_MAP from "@/lib/eve-systems-regions.json";

const regionsMap = REGIONS_MAP as Record<string, string>;

interface Timer {
  id: string;
  expiresAt: string;
  kind: string;
}

interface Props {
  id: string;
  kind: StructureKind;
  system: string;
  distanceFromSun: number;
  name: string | null;
  corporation: string | null;
  currentState: StructureState;
  activeTimer?: Timer | null;
  needsVerification?: boolean;
}

export default function StructureCard({
  id,
  kind,
  system,
  distanceFromSun,
  name,
  corporation,
  currentState,
  activeTimer,
  needsVerification,
}: Props) {
  return (
    <Link href={`/structures/${id}`} className="card block hover:border-eve-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{system}</span>
            <span className="text-eve-muted text-xs">{distanceFromSun} AU</span>
            <span className={`text-xs rounded px-1.5 py-0.5 font-semibold border ${
              kind === "CITADEL"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-eve-accent/10 text-eve-accent border-eve-accent/30"
            }`}>
              {kind}
            </span>
            {needsVerification && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 font-semibold">
                Needs Verification
              </span>
            )}
          </div>
          <div className="text-xs text-eve-muted mt-0.5 space-x-2">
            <span className="text-eve-gold/80">{regionsMap[system] ?? "Unknown"}</span>
            {name && <span>· {name}</span>}
            {corporation && <span>· <span className="text-eve-gold">{corporation}</span></span>}
          </div>
        </div>
        <StateBadge state={currentState} />
      </div>

      {activeTimer && (
        <div className="mt-3 text-xs text-eve-muted border-t border-eve-border pt-2 space-y-0.5">
          <div className="flex items-center gap-2">
            <span>
              {activeTimer.kind === "SHIELD_TO_ARMOR" ? "Armor starts" : "Hull starts"}:
            </span>
            <TimerCountdown expiresAt={activeTimer.expiresAt} />
          </div>
          <LocalTime expiresAt={activeTimer.expiresAt} className="text-eve-muted/70" />
        </div>
      )}
    </Link>
  );
}

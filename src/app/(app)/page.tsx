import { prisma } from "@/lib/prisma";
import StructureCard from "@/components/StructureCard";
import TimerCountdown from "@/components/TimerCountdown";
import { StructureState } from "@prisma/client";
import Link from "next/link";
import REGIONS_MAP from "@/lib/eve-systems-regions.json";

const regionsMap = REGIONS_MAP as Record<string, string>;
function getRegion(system: string): string {
  return regionsMap[system] ?? "Unknown Region";
}

// HULL_VULNERABLE always first, then ARMOR_VULNERABLE, then timer states by time
const STATE_PRIORITY: Record<StructureState, number> = {
  HULL_VULNERABLE: 0,
  ARMOR_VULNERABLE: 1,
  HULL_TIMER: 2,
  ARMOR_TIMER: 3,
  SHIELD: 99, // excluded from dashboard
  DEAD: 99,   // excluded from dashboard
};

export const revalidate = 30;

export default async function DashboardPage() {
  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      currentState: { notIn: ["DEAD", "SHIELD"] },
    },
    include: {
      timers: {
        where: { status: "PENDING" },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Sort: HULL_VULNERABLE first, ARMOR_VULNERABLE second,
  //       then timer states sorted by time remaining (soonest first)
  const sorted = structures.sort((a, b) => {
    const aPri = STATE_PRIORITY[a.currentState];
    const bPri = STATE_PRIORITY[b.currentState];
    if (aPri !== bPri) return aPri - bPri;
    // Same priority group — sort by timer expiry
    const aTime = a.timers[0]?.expiresAt.getTime() ?? Infinity;
    const bTime = b.timers[0]?.expiresAt.getTime() ?? Infinity;
    return aTime - bTime;
  });

  const timerCount = sorted.filter(
    (s) => s.currentState === "ARMOR_TIMER" || s.currentState === "HULL_TIMER"
  ).length;

  const vulnCount = sorted.filter(
    (s) =>
      s.currentState === "ARMOR_VULNERABLE" ||
      s.currentState === "HULL_VULNERABLE"
  ).length;

  // Next expiring timer across all structures
  const nextTimer = sorted
    .filter((s) => s.timers[0])
    .sort(
      (a, b) =>
        a.timers[0].expiresAt.getTime() - b.timers[0].expiresAt.getTime()
    )[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-eve-muted">
            Total:{" "}
            <span className="text-white font-semibold">{sorted.length}</span>
          </span>
          {timerCount > 0 && (
            <span className="text-yellow-400">
              Timers active:{" "}
              <span className="font-semibold">{timerCount}</span>
            </span>
          )}
          {vulnCount > 0 && (
            <span className="text-red-400 font-bold animate-pulse">
              Vulnerable: {vulnCount}
            </span>
          )}
        </div>
      </div>

      {/* Next timer banner */}
      {nextTimer && (
        <Link
          href={`/structures/${nextTimer.id}`}
          className="block card border-eve-accent/40 bg-eve-accent/5 hover:border-eve-accent/70 transition-colors"
        >
          <p className="text-xs text-eve-muted uppercase tracking-wide mb-1">
            Next timer — {nextTimer.system}
            <span className="text-eve-gold"> · {getRegion(nextTimer.system)}</span>
            {nextTimer.corporation ? ` · ${nextTimer.corporation}` : ""}
          </p>
          <div className="flex items-baseline gap-3">
            <TimerCountdown
              expiresAt={nextTimer.timers[0].expiresAt.toISOString()}
              className="text-2xl"
            />
            <span className="text-xs text-eve-muted">
              {nextTimer.timers[0].kind === "SHIELD_TO_ARMOR"
                ? "until armor window"
                : "until hull window"}
            </span>
          </div>
          <p className="text-xs text-eve-muted mt-1">
            {new Date(nextTimer.timers[0].expiresAt).toUTCString()}
          </p>
        </Link>
      )}

      {sorted.length === 0 ? (
        <div className="card text-center py-12 text-eve-muted">
          <p>No active structures. <a href="/structures/new" className="text-eve-accent hover:underline">Add one</a>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((s) => (
            <StructureCard
              key={s.id}
              id={s.id}
              kind={s.kind}
              system={s.system}
              distanceFromSun={s.distanceFromSun}
              name={s.name}
              corporation={s.corporation}
              currentState={s.currentState}
              needsVerification={s.needsVerification}
              activeTimer={
                s.timers[0]
                  ? {
                      id: s.timers[0].id,
                      expiresAt: s.timers[0].expiresAt.toISOString(),
                      kind: s.timers[0].kind,
                    }
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

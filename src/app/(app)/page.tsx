import { prisma } from "@/lib/prisma";
import StructureCard from "@/components/StructureCard";
import TimerCountdown from "@/components/TimerCountdown";
import { StructureState } from "@prisma/client";
import Link from "next/link";

// Used only for structures without an active timer (VULNERABLE / SHIELD)
const STATE_PRIORITY: Record<StructureState, number> = {
  HULL_VULNERABLE: 0,
  ARMOR_VULNERABLE: 1,
  HULL_TIMER: 2,
  ARMOR_TIMER: 3,
  SHIELD: 4,
  DEAD: 5,
};

export const revalidate = 30;

export default async function DashboardPage() {
  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      currentState: { not: "DEAD" },
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

  // Sort: structures with active timer → by time remaining (soonest first)
  //       structures without timer (VULNERABLE / SHIELD) → by state urgency after
  const sorted = structures.sort((a, b) => {
    const aTime = a.timers[0]?.expiresAt.getTime() ?? null;
    const bTime = b.timers[0]?.expiresAt.getTime() ?? null;
    if (aTime !== null && bTime !== null) return aTime - bTime;
    if (aTime !== null) return -1; // a has timer, b doesn't → a first
    if (bTime !== null) return 1;  // b has timer, a doesn't → b first
    return STATE_PRIORITY[a.currentState] - STATE_PRIORITY[b.currentState];
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

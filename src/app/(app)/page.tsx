import { prisma } from "@/lib/prisma";
import StructureCard from "@/components/StructureCard";
import { StructureState } from "@prisma/client";

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

  const sorted = structures.sort(
    (a, b) =>
      STATE_PRIORITY[a.currentState] - STATE_PRIORITY[b.currentState] ||
      (a.timers[0]?.expiresAt.getTime() ?? Infinity) -
        (b.timers[0]?.expiresAt.getTime() ?? Infinity)
  );

  const timerCount = sorted.filter(
    (s) => s.currentState === "ARMOR_TIMER" || s.currentState === "HULL_TIMER"
  ).length;

  const vulnCount = sorted.filter(
    (s) =>
      s.currentState === "ARMOR_VULNERABLE" ||
      s.currentState === "HULL_VULNERABLE"
  ).length;

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
              system={s.system}
              distanceFromSun={s.distanceFromSun}
              name={s.name}
              corporation={s.corporation}
              currentState={s.currentState}
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

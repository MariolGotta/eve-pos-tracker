import { prisma } from "@/lib/prisma";
import { StructureState } from "@prisma/client";
import StructureCard from "@/components/StructureCard";
import StructureFilters from "./StructureFilters";
import Link from "next/link";

export const revalidate = 30;

const ALL_STATES: StructureState[] = [
  "SHIELD",
  "ARMOR_TIMER",
  "ARMOR_VULNERABLE",
  "HULL_TIMER",
  "HULL_VULNERABLE",
  "DEAD",
];

const STATE_PRIORITY: Record<StructureState, number> = {
  HULL_VULNERABLE: 0,
  ARMOR_VULNERABLE: 1,
  HULL_TIMER: 2,
  ARMOR_TIMER: 3,
  SHIELD: 4,
  DEAD: 5,
};

export default async function StructuresPage({
  searchParams,
}: {
  searchParams: { system?: string; state?: string; corp?: string; dead?: string; kind?: string; focus?: string };
}) {
  const { system, state, corp, dead, kind, focus } = searchParams;
  const includeDead = dead === "1";
  const validKind = kind === "POS" || kind === "CITADEL" ? kind : null;
  const focusedSystem = focus?.trim().toUpperCase() ?? null;

  const validState =
    state && ALL_STATES.includes(state as StructureState)
      ? (state as StructureState)
      : null;

  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      ...(system ? { system: { contains: system, mode: "insensitive" } } : {}),
      ...(corp ? { corporation: { contains: corp, mode: "insensitive" } } : {}),
      ...(validKind ? { kind: validKind } : {}),
      ...(validState
        ? { currentState: validState }
        : !includeDead
        ? { currentState: { not: "DEAD" } }
        : {}),
    },
    include: {
      timers: {
        where: { status: "PENDING" },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
    },
    orderBy: [{ system: "asc" }, { updatedAt: "desc" }],
  });

  // Group by system
  const systemMap = new Map<string, typeof structures>();
  for (const s of structures) {
    const key = s.system.toUpperCase();
    if (!systemMap.has(key)) systemMap.set(key, []);
    systemMap.get(key)!.push(s);
  }

  // Sort structures within each system by state priority then timer
  for (const [, group] of systemMap) {
    group.sort((a, b) => {
      const aPri = STATE_PRIORITY[a.currentState];
      const bPri = STATE_PRIORITY[b.currentState];
      if (aPri !== bPri) return aPri - bPri;
      const aTime = a.timers[0]?.expiresAt.getTime() ?? Infinity;
      const bTime = b.timers[0]?.expiresAt.getTime() ?? Infinity;
      return aTime - bTime;
    });
  }

  // Sort systems: focused system first, then alphabetically
  const systemNames = [...systemMap.keys()].sort((a, b) => {
    if (focusedSystem) {
      if (a === focusedSystem) return -1;
      if (b === focusedSystem) return 1;
    }
    return a.localeCompare(b);
  });

  // Build focus/unfocus URL helper
  function focusUrl(systemKey: string, currentParams: typeof searchParams): string {
    const params = new URLSearchParams();
    if (currentParams.system) params.set("system", currentParams.system);
    if (currentParams.corp) params.set("corp", currentParams.corp);
    if (currentParams.kind) params.set("kind", currentParams.kind);
    if (currentParams.state) params.set("state", currentParams.state);
    if (currentParams.dead) params.set("dead", currentParams.dead);
    if (focusedSystem === systemKey) {
      // toggle off
    } else {
      params.set("focus", systemMap.get(systemKey)![0].system); // original casing
    }
    const qs = params.toString();
    return `/structures${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Structures</h1>
        <Link href="/structures/new" className="btn-primary text-sm">
          + New POS
        </Link>
      </div>

      {/* Filters */}
      <StructureFilters defaults={{ system, corp, kind, state, dead }} />

      <p className="text-xs text-eve-muted">
        {structures.length} structure(s) · {systemNames.length} system(s)
        {focusedSystem && (
          <> · <span className="text-eve-accent">Focus: {focusedSystem}</span></>
        )}
      </p>

      {structures.length === 0 ? (
        <div className="card text-center py-12 text-eve-muted">
          No structures match the current filters.
        </div>
      ) : (
        <div className="space-y-8">
          {systemNames.map((sysKey) => {
            const group = systemMap.get(sysKey)!;
            const isFocused = focusedSystem === sysKey;
            const systemDisplayName = group[0].system;

            return (
              <section key={sysKey}>
                {/* System header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`text-base font-bold ${isFocused ? "text-eve-accent" : "text-white"}`}>
                    {systemDisplayName}
                  </h2>
                  <span className="text-xs text-eve-muted">{group.length} structure(s)</span>
                  <Link
                    href={focusUrl(sysKey, searchParams)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      isFocused
                        ? "bg-eve-accent/20 border-eve-accent/50 text-eve-accent hover:bg-eve-accent/10"
                        : "border-eve-border text-eve-muted hover:border-eve-accent/40 hover:text-eve-accent"
                    }`}
                  >
                    {isFocused ? "★ Focused" : "☆ Focus"}
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map((s) => (
                    <StructureCard
                      key={s.id}
                      id={s.id}
                      kind={s.kind}
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
                      needsVerification={s.needsVerification}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

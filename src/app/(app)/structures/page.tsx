import { prisma } from "@/lib/prisma";
import { StructureState } from "@prisma/client";
import StructureCard from "@/components/StructureCard";
import StructureFilters from "./StructureFilters";
import RegionSection from "./RegionSection";
import Link from "next/link";
import REGIONS_MAP from "@/lib/eve-systems-regions.json";

export const revalidate = 30;

const ALL_STATES: StructureState[] = [
  "SHIELD", "ARMOR_TIMER", "ARMOR_VULNERABLE",
  "HULL_TIMER", "HULL_VULNERABLE", "DEAD",
];

const STATE_PRIORITY: Record<StructureState, number> = {
  HULL_VULNERABLE: 0,
  ARMOR_VULNERABLE: 1,
  HULL_TIMER: 2,
  ARMOR_TIMER: 3,
  SHIELD: 4,
  DEAD: 5,
};

const regionsMap = REGIONS_MAP as Record<string, string>;

function getRegion(system: string): string {
  return regionsMap[system] ?? regionsMap[system.toUpperCase()] ?? "Unknown Region";
}

function sortStructures(list: typeof structures) {
  return [...list].sort((a, b) => {
    const aPri = STATE_PRIORITY[a.currentState];
    const bPri = STATE_PRIORITY[b.currentState];
    if (aPri !== bPri) return aPri - bPri;
    const aTime = a.timers[0]?.expiresAt.getTime() ?? Infinity;
    const bTime = b.timers[0]?.expiresAt.getTime() ?? Infinity;
    return aTime - bTime;
  });
}

// Keep a reference for typing
type Structure = Awaited<ReturnType<typeof prisma.structure.findMany<{
  include: { timers: true }
}>>>[number];
let structures: Structure[] = [];

function renderCard(s: Structure) {
  return (
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
          ? { id: s.timers[0].id, expiresAt: s.timers[0].expiresAt.toISOString(), kind: s.timers[0].kind }
          : null
      }
      needsVerification={s.needsVerification}
    />
  );
}

export default async function StructuresPage({
  searchParams,
}: {
  searchParams: {
    system?: string; state?: string; corp?: string;
    dead?: string; kind?: string; focus?: string;
  };
}) {
  const { system, state, corp, dead, kind, focus } = searchParams;
  const includeDead = dead === "1";
  const validKind = kind === "POS" || kind === "CITADEL" ? kind : null;
  const focusedSystem = focus?.trim() ?? null;
  const focusedKey = focusedSystem?.toUpperCase() ?? null;

  const validState =
    state && ALL_STATES.includes(state as StructureState)
      ? (state as StructureState)
      : null;

  structures = await prisma.structure.findMany({
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
    orderBy: [{ system: "asc" }],
  });

  // ── Group: region → system → structures ────────────────────────────────────
  type SystemGroup = { displayName: string; structures: Structure[] };
  type RegionGroup = { systems: Map<string, SystemGroup> };

  const regionMap = new Map<string, RegionGroup>();

  for (const s of structures) {
    const region = getRegion(s.system);
    const sysKey = s.system.toUpperCase();

    if (!regionMap.has(region)) regionMap.set(region, { systems: new Map() });
    const rg = regionMap.get(region)!;
    if (!rg.systems.has(sysKey)) rg.systems.set(sysKey, { displayName: s.system, structures: [] });
    rg.systems.get(sysKey)!.structures.push(s);
  }

  // Sort structures within each system
  for (const rg of regionMap.values()) {
    for (const sg of rg.systems.values()) {
      sg.structures = sortStructures(sg.structures);
    }
  }

  // Sort region names alphabetically; sort systems within each region
  const sortedRegions = [...regionMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // ── Focused system data ─────────────────────────────────────────────────────
  let focusedGroup: SystemGroup | null = null;
  if (focusedKey) {
    for (const rg of regionMap.values()) {
      if (rg.systems.has(focusedKey)) {
        focusedGroup = rg.systems.get(focusedKey)!;
        break;
      }
    }
  }

  function focusUrl(sysDisplayName: string): string {
    const params = new URLSearchParams();
    if (system) params.set("system", system);
    if (corp) params.set("corp", corp);
    if (kind) params.set("kind", kind);
    if (state) params.set("state", state);
    if (dead) params.set("dead", dead);
    const isFocused = focusedKey === sysDisplayName.toUpperCase();
    if (!isFocused) params.set("focus", sysDisplayName);
    const qs = params.toString();
    return `/structures${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Structures</h1>
        <Link href="/structures/new" className="btn-primary text-sm">+ New POS</Link>
      </div>

      <StructureFilters defaults={{ system, corp, kind, state, dead }} />

      <p className="text-xs text-eve-muted">
        {structures.length} structure(s) · {[...regionMap.keys()].length} region(s)
        {focusedSystem && (
          <> · <span className="text-eve-accent font-semibold">★ Focus: {focusedSystem}</span></>
        )}
      </p>

      {structures.length === 0 ? (
        <div className="card text-center py-12 text-eve-muted">
          No structures match the current filters.
        </div>
      ) : (
        <div className="space-y-2">

          {/* ── Pinned focused system ─────────────────────────────────────── */}
          {focusedGroup && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-eve-accent/10 border border-eve-accent/40">
                <span className="text-eve-accent text-lg">★</span>
                <div>
                  <p className="text-xs text-eve-accent uppercase tracking-widest font-semibold">Focused System</p>
                  <p className="text-white font-bold text-lg">{focusedGroup.displayName}</p>
                  <p className="text-xs text-eve-muted">{getRegion(focusedGroup.displayName)} · {focusedGroup.structures.length} structure(s)</p>
                </div>
                <div className="flex-1" />
                <Link
                  href={focusUrl(focusedGroup.displayName)}
                  className="text-xs px-3 py-1 rounded border border-eve-accent/50 text-eve-accent hover:bg-eve-accent/20 transition-colors"
                >
                  ✕ Remove Focus
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {focusedGroup.structures.map(renderCard)}
              </div>
              <div className="border-t border-eve-border/40 mt-8" />
            </div>
          )}

          {/* ── Regions ───────────────────────────────────────────────────── */}
          <div className="space-y-8">
            {sortedRegions.map(([region, rg]) => {
              const sortedSystems = [...rg.systems.entries()].sort(([a], [b]) => a.localeCompare(b));
              const totalStructures = sortedSystems.reduce((n, [, sg]) => n + sg.structures.length, 0);

              return (
                <RegionSection
                  key={region}
                  region={region}
                  systemCount={sortedSystems.length}
                  structureCount={totalStructures}
                  defaultOpen={true}
                >
                  {sortedSystems.map(([sysKey, sg]) => {
                    const isFocused = focusedKey === sysKey;
                    return (
                      <section key={sysKey}>
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className={`text-sm font-bold ${isFocused ? "text-eve-accent" : "text-white"}`}>
                            {sg.displayName}
                          </h3>
                          <span className="text-xs text-eve-muted">{sg.structures.length} structure(s)</span>
                          <Link
                            href={focusUrl(sg.displayName)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              isFocused
                                ? "bg-eve-accent/20 border-eve-accent/50 text-eve-accent"
                                : "border-eve-border text-eve-muted hover:border-eve-accent/40 hover:text-eve-accent"
                            }`}
                          >
                            {isFocused ? "★ Focused" : "☆ Focus"}
                          </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {sg.structures.map(renderCard)}
                        </div>
                      </section>
                    );
                  })}
                </RegionSection>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

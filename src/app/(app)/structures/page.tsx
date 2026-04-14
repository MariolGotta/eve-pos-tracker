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

// ALL_STATES kept for the WHERE clause validation below
export default async function StructuresPage({
  searchParams,
}: {
  searchParams: { system?: string; state?: string; corp?: string; dead?: string; kind?: string };
}) {
  const { system, state, corp, dead, kind } = searchParams;
  const includeDead = dead === "1";
  const validKind = kind === "POS" || kind === "CITADEL" ? kind : null;

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
    orderBy: [{ currentState: "asc" }, { updatedAt: "desc" }],
  });

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

      <p className="text-xs text-eve-muted">{structures.length} structure(s)</p>

      {structures.length === 0 ? (
        <div className="card text-center py-12 text-eve-muted">
          No structures match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map((s) => (
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
      )}
    </div>
  );
}

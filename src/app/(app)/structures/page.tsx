import { prisma } from "@/lib/prisma";
import { StructureState } from "@prisma/client";
import StructureCard from "@/components/StructureCard";
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

export default async function StructuresPage({
  searchParams,
}: {
  searchParams: { system?: string; state?: string; corp?: string; dead?: string };
}) {
  const { system, state, corp, dead } = searchParams;
  const includeDead = dead === "1";

  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      ...(system
        ? { system: { contains: system, mode: "insensitive" } }
        : {}),
      ...(state && ALL_STATES.includes(state as StructureState)
        ? { currentState: state as StructureState }
        : {}),
      ...(corp
        ? { corporation: { contains: corp, mode: "insensitive" } }
        : {}),
      ...(!includeDead ? { currentState: { not: "DEAD" } } : {}),
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
      <form className="flex flex-wrap gap-3">
        <input
          name="system"
          defaultValue={system}
          placeholder="Filter by system…"
          className="w-48"
        />
        <input
          name="corp"
          defaultValue={corp}
          placeholder="Filter by corporation…"
          className="w-48"
        />
        <select name="state" defaultValue={state ?? ""} className="w-44">
          <option value="">All states</option>
          {ALL_STATES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            name="dead"
            value="1"
            defaultChecked={includeDead}
            className="w-auto border-0 p-0"
          />
          Include dead
        </label>
        <button type="submit" className="btn-primary text-sm">
          Filter
        </button>
        <a href="/structures" className="btn-ghost text-sm">
          Clear
        </a>
      </form>

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

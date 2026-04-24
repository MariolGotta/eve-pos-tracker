import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewKillmailModal } from "./NewKillmailModal";

function formatIsk(isk: bigint): string {
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  return (n / 1_000).toFixed(1) + "K";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function KillmailsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const status = searchParams.status === "PENDING" ? "PENDING" : searchParams.status === "COMPLETE" ? "COMPLETE" : undefined;
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const limit = 30;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const [killmails, total] = await Promise.all([
    db.killmail.findMany({
      where: status ? { status } : {},
      include: { _count: { select: { attackers: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.killmail.count({ where: status ? { status } : {} }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/ppk" className="text-eve-muted hover:text-white text-sm">
              ← PPK
            </Link>
            <h1 className="text-xl font-bold text-eve-accent tracking-wider">Killmails</h1>
          </div>
          <p className="text-eve-muted text-sm mt-1">{total} killmails registered</p>
        </div>

        <div className="flex items-center gap-4">
          <NewKillmailModal />

          {/* Status filter */}
          <div className="flex gap-2">
          <Link
            href="/ppk/killmails"
            className={`btn-ghost text-xs px-3 py-1.5 ${!status ? "text-eve-accent" : ""}`}
          >
            All
          </Link>
          <Link
            href="/ppk/killmails?status=PENDING"
            className={`btn-ghost text-xs px-3 py-1.5 ${status === "PENDING" ? "text-eve-gold" : ""}`}
          >
            Pending
          </Link>
          <Link
            href="/ppk/killmails?status=COMPLETE"
            className={`btn-ghost text-xs px-3 py-1.5 ${status === "COMPLETE" ? "text-eve-green" : ""}`}
          >
            Complete
          </Link>
          </div>
        </div>
      </div>

      <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">System</th>
              <th className="text-left px-4 py-3">Victim</th>
              <th className="text-left px-4 py-3">Ship</th>
              <th className="text-right px-4 py-3">ISK Value</th>
              <th className="text-right px-4 py-3">Damage %</th>
              <th className="text-center px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {killmails.map((km: any) => (
              <tr key={km.id} className="border-b border-eve-border hover:bg-eve-bg">
                <td className="px-4 py-2">
                  <Link href={`/ppk/killmails/${km.id}`} className="text-eve-accent hover:underline font-mono text-xs">
                    {km.id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-eve-muted text-xs">{formatDate(km.timestampUtc)}</td>
                <td className="px-4 py-2">{km.system}</td>
                <td className="px-4 py-2">
                  <span className="text-eve-muted">[{km.victimCorpTag}]</span> {km.victimPilot}
                </td>
                <td className="px-4 py-2 text-eve-muted text-xs">{km.victimShip}</td>
                <td className="px-4 py-2 text-right font-medium">{formatIsk(km.iskValue)}</td>
                <td className="px-4 py-2 text-right text-xs">
                  {km.damageCoverage.toFixed(1)}%
                  <span className="text-eve-muted ml-1">({km._count.attackers} attackers)</span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${km.status === "COMPLETE" ? "bg-eve-green/20 text-eve-green" : "bg-eve-gold/20 text-eve-gold"}`}>
                    {km.status === "COMPLETE" ? "COMPLETE" : "PENDING"}
                  </span>
                </td>
              </tr>
            ))}
            {killmails.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-eve-muted">
                  No killmails found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/ppk/killmails?${status ? `status=${status}&` : ""}page=${p}`}
              className={`btn-ghost text-xs px-3 py-1.5 ${p === page ? "text-eve-accent" : ""}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

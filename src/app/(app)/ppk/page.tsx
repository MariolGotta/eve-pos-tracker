import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatIsk(isk: bigint): string {
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default async function PpkPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any; // PPK models available after: npx prisma migrate dev && npx prisma generate
  const players = await db.player.findMany({
    orderBy: { remaining: "desc" },
    take: 200,
  });

  const totalOwed = players.reduce((s: bigint, p: any) => s + p.remaining, BigInt(0));
  const totalPaid = players.reduce((s: bigint, p: any) => s + p.totalPaid, BigInt(0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-eve-accent tracking-wider">PPK — Pay Per Kill</h1>
          <p className="text-eve-muted text-sm mt-1">Saldos de participação em killmails</p>
        </div>
        <Link href="/ppk/killmails" className="btn-ghost text-xs px-3 py-1.5">
          Ver Killmails
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">Total a Pagar</div>
          <div className="text-eve-gold font-bold text-lg">{formatIsk(totalOwed)} ISK</div>
        </div>
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">Já Pago</div>
          <div className="text-eve-green font-bold text-lg">{formatIsk(totalPaid)} ISK</div>
        </div>
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">Players</div>
          <div className="text-white font-bold text-lg">{players.length}</div>
        </div>
      </div>

      {/* Player table */}
      <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Piloto</th>
              <th className="text-left px-4 py-3">Corp</th>
              <th className="text-right px-4 py-3">Total Ganho</th>
              <th className="text-right px-4 py-3">Já Pago</th>
              <th className="text-right px-4 py-3">A Receber</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p: typeof players[number], i: number) => (
              <tr
                key={p.id}
                className="border-b border-eve-border hover:bg-eve-bg transition-colors"
              >
                <td className="px-4 py-3 text-eve-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/ppk/${encodeURIComponent(p.pilot)}`}
                    className="text-eve-accent hover:underline font-medium"
                  >
                    {p.pilot}
                  </Link>
                </td>
                <td className="px-4 py-3 text-eve-muted">[{p.corpTag ?? "?"}]</td>
                <td className="px-4 py-3 text-right text-white">{formatIsk(p.totalEarned)}</td>
                <td className="px-4 py-3 text-right text-eve-green">{formatIsk(p.totalPaid)}</td>
                <td className={`px-4 py-3 text-right font-bold ${p.remaining > BigInt(0) ? "text-eve-gold" : "text-eve-muted"}`}>
                  {formatIsk(p.remaining)}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-eve-muted">
                  Nenhum player registrado ainda. Envie killmails via /ppk no Discord.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

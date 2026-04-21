import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

function formatIsk(isk: bigint): string {
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function PlayerPage({ params }: { params: { pilot: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const pilot = decodeURIComponent(params.pilot);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const player = await db.player.findUnique({
    where: { pilot },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!player) notFound();

  // Get killmails this player participated in
  const attackerRecords = await db.killmailAttacker.findMany({
    where: { pilot },
    include: {
      killmail: {
        select: {
          id: true, system: true, iskValue: true, shipType: true,
          victimPilot: true, victimCorpTag: true, victimShip: true,
          timestampUtc: true, status: true,
        },
      },
    },
    orderBy: { killmail: { timestampUtc: "desc" } },
    take: 100,
  });

  const isOwner = session.user.role === "OWNER";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ppk" className="text-eve-muted hover:text-white text-sm">
          ← PPK
        </Link>
        <span className="text-eve-border">/</span>
        <h1 className="text-xl font-bold text-white">{pilot}</h1>
        <span className="text-eve-muted text-sm">[{player.corpTag ?? "?"}]</span>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">Total Ganho</div>
          <div className="text-white font-bold text-lg">{formatIsk(player.totalEarned)} ISK</div>
        </div>
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">Já Recebeu</div>
          <div className="text-eve-green font-bold text-lg">{formatIsk(player.totalPaid)} ISK</div>
        </div>
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-1">A Receber</div>
          <div className={`font-bold text-lg ${player.remaining > 0n ? "text-eve-gold" : "text-eve-muted"}`}>
            {formatIsk(player.remaining)} ISK
          </div>
        </div>
      </div>

      {/* Kill participation */}
      <div>
        <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-3">
          Killmails ({attackerRecords.length})
        </h2>
        <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Sistema</th>
                <th className="text-left px-4 py-3">Vítima</th>
                <th className="text-left px-4 py-3">Nave</th>
                <th className="text-right px-4 py-3">Dano %</th>
                <th className="text-right px-4 py-3">ISK Ganho</th>
              </tr>
            </thead>
            <tbody>
              {attackerRecords.map((a: any) => (
                <tr key={a.id} className="border-b border-eve-border hover:bg-eve-bg">
                  <td className="px-4 py-2 text-eve-muted text-xs">
                    {formatDate(a.killmail.timestampUtc)}
                  </td>
                  <td className="px-4 py-2">{a.killmail.system}</td>
                  <td className="px-4 py-2">
                    <Link href={`/ppk/killmails/${a.killmail.id}`} className="text-eve-accent hover:underline">
                      [{a.killmail.victimCorpTag}] {a.killmail.victimPilot}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-eve-muted text-xs">{a.killmail.victimShip}</td>
                  <td className="px-4 py-2 text-right">{a.damagePct.toFixed(1)}%</td>
                  <td className={`px-4 py-2 text-right font-medium ${a.iskEarned && a.iskEarned > 0n ? "text-eve-gold" : "text-eve-muted"}`}>
                    {a.iskEarned ? formatIsk(a.iskEarned) : a.killmail.status === "PENDING" ? "—" : "0"}
                  </td>
                </tr>
              ))}
              {attackerRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-eve-muted">Nenhuma killmail encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment history */}
      {player.payments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-3">
            Pagamentos Recebidos
          </h2>
          <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-right px-4 py-3">ISK</th>
                  <th className="text-left px-4 py-3">Notas</th>
                </tr>
              </thead>
              <tbody>
                {player.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-eve-border">
                    <td className="px-4 py-2 text-eve-muted text-xs">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-2 text-right text-eve-green font-medium">{formatIsk(p.iskAmount)}</td>
                    <td className="px-4 py-2 text-eve-muted text-xs">{p.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Owner: register payment */}
      {isOwner && player.remaining > 0n && (
        <div className="bg-eve-panel border border-eve-border rounded p-4">
          <p className="text-eve-muted text-xs mb-2">
            Registrar pagamento: use a API <code className="text-eve-accent">POST /api/admin/players/{player.id}/pay</code>{" "}
            com <code className="text-eve-accent">{`{ iskAmount, notes }`}</code> ou acesse <Link href="/admin/ppk" className="text-eve-accent underline">/admin/ppk</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

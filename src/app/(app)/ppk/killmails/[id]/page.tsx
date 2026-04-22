import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { KillmailAttackersClient } from "./KillmailAttackersClient";
import type { AttackerRow } from "./KillmailAttackersClient";

function formatIsk(isk: bigint | null): string {
  if (!isk) return "—";
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

export default async function KillmailDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: {
      attackers: { orderBy: { damagePct: "desc" } },
    },
  });

  if (!km) notFound();

  const isOwner = session.user.role === "OWNER";
  const totalIskEarned = km.attackers.reduce(
    (s: bigint, a: any) => s + (a.iskEarned ?? BigInt(0)),
    BigInt(0)
  );

  // Serialize BigInt fields for client component (Next.js can't pass BigInt via props)
  const attackersForClient: AttackerRow[] = km.attackers.map((a: any) => ({
    id: a.id,
    pilot: a.pilot,
    corpTag: a.corpTag,
    ship: a.ship,
    damage: Number(a.damage),
    damagePct: Number(a.damagePct),
    iskEarned: a.iskEarned != null ? String(a.iskEarned) : null,
    finalBlow: a.finalBlow,
    topDamage: a.topDamage,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ppk/killmails" className="text-eve-muted hover:text-white text-sm">
          ← Killmails
        </Link>
        <span className="text-eve-border">/</span>
        <span className="font-mono text-eve-muted text-sm">{km.id}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            km.status === "COMPLETE"
              ? "bg-eve-green/20 text-eve-green"
              : "bg-eve-gold/20 text-eve-gold"
          }`}
        >
          {km.status === "COMPLETE" ? "COMPLETA" : "PENDENTE"}
        </span>
      </div>

      {/* Header info */}
      <div className="bg-eve-panel border border-eve-border rounded p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Vítima</div>
          <div className="font-medium">
            [{km.victimCorpTag}] {km.victimPilot}
          </div>
          <div className="text-eve-muted text-xs mt-0.5">{km.victimShip}</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Local / Data</div>
          <div className="font-medium">
            {km.system}
            {km.region ? ` — ${km.region}` : ""}
          </div>
          <div className="text-eve-muted text-xs mt-0.5">{formatDate(km.timestampUtc)}</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Valor do Kill</div>
          <div className="font-bold text-eve-gold">{formatIsk(km.iskValue)} ISK</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">
            Cobertura de Dano
          </div>
          <div className="font-medium">
            {km.damageCoverage.toFixed(1)}%{" "}
            <span className="text-eve-muted text-xs">
              ({km.attackers.length}
              {km.participantsTotal ? `/${km.participantsTotal}` : ""} atacantes)
            </span>
          </div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">
            Total ISK Distribuído
          </div>
          <div className="font-bold text-eve-accent">{formatIsk(totalIskEarned)} ISK</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Tipo de Nave</div>
          <div>{km.shipType}</div>
        </div>
      </div>

      {/* Attackers table — interactive client component */}
      <div>
        <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-3">
          Participantes
        </h2>
        <KillmailAttackersClient kmId={params.id} initialAttackers={attackersForClient} />
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="text-eve-muted text-xs">
          Para deletar esta killmail e reverter saldos:{" "}
          <code className="text-eve-accent">DELETE /api/killmails/{km.id}</code>
        </div>
      )}
    </div>
  );
}
